const { loadEnvFile } = require("./loadEnv");
loadEnvFile();

const { config, validateConfig } = require("./config");
const logger = require("./logger");
const { fetchAllMarkets } = require("./gammaClient");
const { pickCandidates } = require("./strategy");
const { readState, writeState, markToMarket } = require("./stateStore");
const { executeCandidates } = require("./executor");
const { startWebServer } = require("./webServer");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printSummary(summary) {
  logger.info("portfolio", {
    cashUsedUsd: summary.cashUsedUsd.toFixed(2),
    marketValue: summary.marketValue.toFixed(2),
    unrealizedPnl: summary.unrealizedPnl.toFixed(2),
    totalPnl: summary.totalPnl.toFixed(2),
  });
}

async function runScan(runtime) {
  const state = readState();
  const markets = await fetchAllMarkets();
  const candidates = pickCandidates(markets, state);
  const { executed, dynamicOrderUsd, accountTotalUsd } = await executeCandidates(candidates, state);
  const summary = markToMarket(state, markets);
  state.summary = summary;
  state.lastScan = {
    at: new Date().toISOString(),
    markets: markets.length,
    candidates: candidates.length,
    executed: executed.length,
    dynamicOrderUsd,
    accountTotalUsd,
  };
  writeState(state);
  runtime.lastDynamicOrderUsd = dynamicOrderUsd;
  runtime.lastAccountTotalUsd = accountTotalUsd;
  runtime.lastScan = state.lastScan;

  logger.info("scan result", {
    markets: markets.length,
    candidates: candidates.length,
    executed: executed.length,
    dynamicOrderUsd: Number(dynamicOrderUsd).toFixed(4),
  });
  if (executed.length) {
    for (const item of executed) {
      logger.info("buy", {
        question: item.question,
        outcome: item.outcome,
        price: item.price,
        orderUsd: item.orderUsd,
        orderId: item.liveResult?.orderID || item.liveResult?.id,
      });
    }
  }
  printSummary(summary);
}

async function main() {
  validateConfig();
  const once = process.argv.includes("--once");
  const runtime = {
    lastDynamicOrderUsd: 0,
    lastAccountTotalUsd: null,
    lastScan: null,
  };
  if (config.webEnabled && !once) {
    startWebServer(runtime, logger);
  }

  logger.info("bot start", {
    mode: config.botMode,
    maxPrice: config.maxPrice,
    orderFraction: config.orderFraction,
    maxExposureUsd: config.maxExposureUsd,
    once,
  });

  if (once) {
    await runScan(runtime);
    return;
  }

  while (true) {
    try {
      await runScan(runtime);
    } catch (err) {
      logger.error("scan failed", { message: err.message });
    }
    await sleep(config.scanIntervalMs);
  }
}

main().catch((err) => {
  logger.error("fatal", { message: err.message });
  process.exit(1);
});
