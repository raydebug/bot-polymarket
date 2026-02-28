const { config } = require("./config");
const { upsertPosition } = require("./stateStore");
const { createLiveClient, placeLiveBuy, getLiveAccountTotalUsd } = require("./liveClient");

function getRemainingExposure(state) {
  return Math.max(0, config.maxExposureUsd - state.cashUsedUsd);
}

function getMarketExposure(state, marketId) {
  let total = 0;
  for (const key of Object.keys(state.positions)) {
    const pos = state.positions[key];
    if (String(pos.marketId) === String(marketId)) total += Number(pos.costUsd || 0);
  }
  return total;
}

async function resolveDynamicOrder(liveClient) {
  let accountTotalUsd = config.paperAccountUsd;
  if (config.botMode === "live") {
    accountTotalUsd = await getLiveAccountTotalUsd(liveClient);
  }
  return {
    accountTotalUsd,
    dynamicOrderUsd: accountTotalUsd * config.orderFraction,
  };
}

async function executeCandidates(candidates, state) {
  const executed = [];
  const liveClient = config.botMode === "live" ? await createLiveClient() : null;
  const { accountTotalUsd, dynamicOrderUsd } = await resolveDynamicOrder(liveClient);
  let localSpentUsd = 0;
  const localMarketSpent = {};

  for (const candidate of candidates) {
    const remaining = Math.max(0, getRemainingExposure(state) - localSpentUsd);
    if (remaining <= 0) break;

    const marketExposure = getMarketExposure(state, candidate.marketId);
    const marketSpent = localMarketSpent[candidate.marketId] || 0;
    const marketRemaining = Math.max(
      0,
      config.maxExposurePerMarketUsd - marketExposure - marketSpent,
    );
    if (marketRemaining <= 0) continue;

    const orderUsd = Math.min(dynamicOrderUsd, remaining);
    const orderUsdFinal = Math.min(orderUsd, marketRemaining);
    if (orderUsdFinal <= 0) break;

    if (config.botMode === "live") {
      const { size, result } = await placeLiveBuy(liveClient, candidate, orderUsdFinal);
      executed.push({ ...candidate, orderUsd: orderUsdFinal, size, liveResult: result });
      localSpentUsd += orderUsdFinal;
      localMarketSpent[candidate.marketId] = marketSpent + orderUsdFinal;
      continue;
    }

    upsertPosition(state, candidate, orderUsdFinal);
    executed.push({ ...candidate, orderUsd: orderUsdFinal });
    localSpentUsd += orderUsdFinal;
    localMarketSpent[candidate.marketId] = marketSpent + orderUsdFinal;
  }
  return { executed, dynamicOrderUsd, accountTotalUsd };
}

module.exports = { executeCandidates };
