const path = require("path");

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}

function toList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const config = {
  botMode: process.env.BOT_MODE || "paper",
  scanIntervalMs: toNumber(process.env.SCAN_INTERVAL_MS, 30_000),
  maxPrice: toNumber(process.env.MAX_PRICE, 0.05),
  minPrice: toNumber(process.env.MIN_PRICE, 0.005),
  minLiquidity: toNumber(process.env.MIN_LIQUIDITY, 500),
  minDaysToEnd: toNumber(process.env.MIN_DAYS_TO_END, 0),
  maxDaysToEnd: toNumber(process.env.MAX_DAYS_TO_END, 365),
  includeKeywords: toList(process.env.INCLUDE_KEYWORDS),
  excludeKeywords: toList(process.env.EXCLUDE_KEYWORDS),
  orderFraction: toNumber(process.env.ORDER_FRACTION, 0.001),
  paperAccountUsd: toNumber(process.env.PAPER_ACCOUNT_USD, 10_000),
  maxOrdersPerScan: toNumber(process.env.MAX_ORDERS_PER_SCAN, 10),
  maxExposurePct: toNumber(process.env.MAX_EXPOSURE_PCT, 5),
  maxExposurePerMarketPct: toNumber(process.env.MAX_EXPOSURE_PER_MARKET_PCT, 1),
  allowRepeatBuys: toBool(process.env.ALLOW_REPEAT_BUYS, false),
  gammaBaseUrl: process.env.GAMMA_BASE_URL || "https://gamma-api.polymarket.com",
  gammaPageSize: toNumber(process.env.GAMMA_PAGE_SIZE, 200),
  gammaTransport: (process.env.GAMMA_TRANSPORT || "auto").toLowerCase(),
  gammaCurlProxy: process.env.GAMMA_CURL_PROXY || "",
  webEnabled: toBool(process.env.WEB_ENABLED, true),
  webAutoOpen: toBool(process.env.WEB_AUTO_OPEN, true),
  webHost: process.env.WEB_HOST || "127.0.0.1",
  webPort: toNumber(process.env.WEB_PORT, 8787),
  stateFile: process.env.STATE_FILE || path.join(process.cwd(), "data", "paper-state.json"),
  live: {
    host: process.env.CLOB_HOST || "https://clob.polymarket.com",
    chainId: toNumber(process.env.CLOB_CHAIN_ID, 137),
    privateKey: process.env.POLYMARKET_PRIVATE_KEY || "",
    funder: process.env.POLYMARKET_FUNDER || "",
    orderType: process.env.LIVE_ORDER_TYPE || "GTC",
  },
};

function validateConfig() {
  if (config.minPrice >= config.maxPrice) {
    throw new Error("MIN_PRICE must be less than MAX_PRICE");
  }
  if (config.orderFraction <= 0) {
    throw new Error("ORDER_FRACTION must be > 0");
  }
  if (config.maxExposurePct <= 0 || config.maxExposurePct > 100) {
    throw new Error("MAX_EXPOSURE_PCT must be in (0, 100]");
  }
  if (config.maxExposurePerMarketPct <= 0 || config.maxExposurePerMarketPct > 100) {
    throw new Error("MAX_EXPOSURE_PER_MARKET_PCT must be in (0, 100]");
  }
  if (config.maxExposurePerMarketPct > config.maxExposurePct) {
    throw new Error("MAX_EXPOSURE_PER_MARKET_PCT must be <= MAX_EXPOSURE_PCT");
  }
  if (!["auto", "fetch", "curl"].includes(config.gammaTransport)) {
    throw new Error("GAMMA_TRANSPORT must be one of: auto, fetch, curl");
  }
  if (!Number.isInteger(config.webPort) || config.webPort <= 0) {
    throw new Error("WEB_PORT must be a positive integer");
  }
  if (config.botMode === "live") {
    if (!config.live.privateKey) throw new Error("POLYMARKET_PRIVATE_KEY is required in live mode");
    if (!config.live.funder) throw new Error("POLYMARKET_FUNDER is required in live mode");
  }
}

module.exports = { config, validateConfig };
