const fs = require("fs");
const path = require("path");
const { config } = require("./config");

function emptyState() {
  return {
    cashUsedUsd: 0,
    positions: {},
    seenTokenIds: {},
    trades: [],
    updatedAt: new Date().toISOString(),
  };
}

function readState() {
  try {
    const raw = fs.readFileSync(config.stateFile, "utf8");
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

function writeState(state) {
  const dir = path.dirname(config.stateFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    config.stateFile,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

function upsertPosition(state, candidate, orderUsd) {
  const qty = orderUsd / candidate.price;
  const old = state.positions[candidate.key] || {
    tokenId: candidate.tokenId,
    marketId: candidate.marketId,
    question: candidate.question,
    outcome: candidate.outcome,
    avgPrice: 0,
    qty: 0,
    costUsd: 0,
    markPrice: candidate.price,
  };

  const newQty = old.qty + qty;
  const newCost = old.costUsd + orderUsd;
  const avgPrice = newCost / newQty;

  state.positions[candidate.key] = {
    ...old,
    qty: newQty,
    costUsd: newCost,
    avgPrice,
    markPrice: candidate.price,
  };
  state.seenTokenIds[candidate.key] = true;
  state.cashUsedUsd += orderUsd;
  state.trades.push({
    ts: new Date().toISOString(),
    side: "BUY",
    mode: "paper",
    tokenId: candidate.tokenId,
    marketId: candidate.marketId,
    question: candidate.question,
    outcome: candidate.outcome,
    price: candidate.price,
    qty,
    costUsd: orderUsd,
  });
}

function markToMarket(state, markets) {
  const latestPrice = {};
  for (const market of markets) {
    for (const leg of market.legs) {
      latestPrice[`${market.id}:${leg.tokenId}`] = leg.price;
    }
  }

  let marketValue = 0;
  let unrealizedPnl = 0;

  for (const key of Object.keys(state.positions)) {
    const pos = state.positions[key];
    const mark = latestPrice[key] ?? pos.markPrice ?? pos.avgPrice;
    pos.markPrice = mark;
    const value = pos.qty * mark;
    marketValue += value;
    unrealizedPnl += value - pos.costUsd;
  }

  return {
    cashUsedUsd: state.cashUsedUsd,
    marketValue,
    unrealizedPnl,
    totalPnl: unrealizedPnl,
  };
}

module.exports = {
  readState,
  writeState,
  upsertPosition,
  markToMarket,
};
