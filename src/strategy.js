const { config } = require("./config");

function daysUntil(endDate) {
  if (!endDate) return null;
  const ts = Date.parse(endDate);
  if (!Number.isFinite(ts)) return null;
  return (ts - Date.now()) / (24 * 60 * 60 * 1000);
}

function matchesTextFilters(question) {
  const q = String(question || "").toLowerCase();
  if (config.includeKeywords.length > 0) {
    const matched = config.includeKeywords.some((kw) => q.includes(kw));
    if (!matched) return false;
  }
  if (config.excludeKeywords.length > 0) {
    const blocked = config.excludeKeywords.some((kw) => q.includes(kw));
    if (blocked) return false;
  }
  return true;
}

function pickCandidates(markets, state) {
  const candidates = [];
  for (const market of markets) {
    if (!market.active || market.closed) continue;
    if (market.liquidity < config.minLiquidity) continue;
    if (!matchesTextFilters(market.question)) continue;

    const d = daysUntil(market.endDate);
    if (d != null && (d < config.minDaysToEnd || d > config.maxDaysToEnd)) continue;

    for (const leg of market.legs) {
      if (leg.price < config.minPrice || leg.price > config.maxPrice) continue;
      const key = `${market.id}:${leg.tokenId}`;
      if (!config.allowRepeatBuys && state.seenTokenIds[key]) continue;

      candidates.push({
        key,
        marketId: market.id,
        tokenId: leg.tokenId,
        question: market.question,
        outcome: leg.outcome,
        price: leg.price,
        liquidity: market.liquidity,
        endDate: market.endDate,
      });
    }
  }

  candidates.sort((a, b) => a.price - b.price || b.liquidity - a.liquidity);
  return candidates.slice(0, Math.max(0, config.maxOrdersPerScan));
}

module.exports = { pickCandidates };
