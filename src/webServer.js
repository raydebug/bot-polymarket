const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { config } = require("./config");
const { readState } = require("./stateStore");
const { updateEnvValues, readEnvMap } = require("./envFile");

const htmlPath = path.join(__dirname, "web", "dashboard.html");

const editableKeys = [
  "BOT_MODE",
  "SCAN_INTERVAL_MS",
  "MAX_ORDERS_PER_SCAN",
  "MAX_PRICE",
  "MIN_PRICE",
  "MIN_LIQUIDITY_MULTIPLIER",
  "MIN_DAYS_TO_END",
  "MAX_DAYS_TO_END",
  "INCLUDE_KEYWORDS",
  "EXCLUDE_KEYWORDS",
  "ORDER_FRACTION",
  "PAPER_ACCOUNT_USD",
  "MAX_EXPOSURE_PCT",
  "MAX_EXPOSURE_PER_MARKET_PCT",
  "ALLOW_REPEAT_BUYS",
  "GAMMA_PAGE_SIZE",
  "GAMMA_TRANSPORT",
  "GAMMA_CURL_PROXY",
  "WEB_ENABLED",
  "WEB_AUTO_OPEN",
  "WEB_HOST",
  "WEB_PORT",
];

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getDashboardConfig() {
  const fallback = {
    BOT_MODE: config.botMode,
    SCAN_INTERVAL_MS: config.scanIntervalMs,
    MAX_ORDERS_PER_SCAN: config.maxOrdersPerScan,
    MAX_PRICE: config.maxPrice,
    MIN_PRICE: config.minPrice,
    MIN_LIQUIDITY_MULTIPLIER: config.minLiquidityMultiplier,
    MIN_DAYS_TO_END: config.minDaysToEnd,
    MAX_DAYS_TO_END: config.maxDaysToEnd,
    INCLUDE_KEYWORDS: (config.includeKeywords || []).join(","),
    EXCLUDE_KEYWORDS: (config.excludeKeywords || []).join(","),
    ORDER_FRACTION: config.orderFraction,
    PAPER_ACCOUNT_USD: config.paperAccountUsd,
    MAX_EXPOSURE_PCT: config.maxExposurePct,
    MAX_EXPOSURE_PER_MARKET_PCT: config.maxExposurePerMarketPct,
    ALLOW_REPEAT_BUYS: config.allowRepeatBuys,
    GAMMA_PAGE_SIZE: config.gammaPageSize,
    GAMMA_TRANSPORT: config.gammaTransport,
    GAMMA_CURL_PROXY: config.gammaCurlProxy,
    WEB_ENABLED: config.webEnabled,
    WEB_AUTO_OPEN: config.webAutoOpen,
    WEB_HOST: config.webHost,
    WEB_PORT: config.webPort,
  };
  const envMap = readEnvMap();
  const out = {};
  for (const [key, value] of Object.entries(fallback)) {
    if (Object.prototype.hasOwnProperty.call(envMap, key)) {
      out[key] = envMap[key];
    } else {
      out[key] = String(value ?? "");
    }
  }
  return out;
}

function deriveStatus(runtime) {
  const state = readState();
  const summary = state.summary || {
    cashUsedUsd: state.cashUsedUsd || 0,
    marketValue: 0,
    totalPnl: 0,
  };
  const accountTotalUsd = config.botMode === "paper"
    ? config.paperAccountUsd
    : runtime.lastAccountTotalUsd || null;
  const maxExposureUsd = accountTotalUsd == null
    ? null
    : accountTotalUsd * (config.maxExposurePct / 100);
  const maxExposurePerMarketUsd = accountTotalUsd == null
    ? null
    : accountTotalUsd * (config.maxExposurePerMarketPct / 100);
  const minLiquidityUsd = maxExposurePerMarketUsd == null
    ? null
    : maxExposurePerMarketUsd * config.minLiquidityMultiplier;
  const positions = Object.values(state.positions || {});

  let settledCount = 0;
  let wonCount = 0;
  let totalCost = 0;
  let totalQty = 0;

  for (const pos of positions) {
    const mark = Number(pos.markPrice ?? pos.avgPrice ?? 0);
    if (mark >= 0.99 || mark <= 0.01) {
      settledCount += 1;
      if (mark >= 0.99) wonCount += 1;
    }
    totalCost += Number(pos.costUsd || 0);
    totalQty += Number(pos.qty || 0);
  }

  const avgEntryPrice = totalQty > 0 ? totalCost / totalQty : null;
  const avgOdds = avgEntryPrice && avgEntryPrice > 0 ? 1 / avgEntryPrice : null;
  const winRate = settledCount > 0 ? (wonCount / settledCount) * 100 : null;

  return {
    mode: config.botMode,
    summary,
    positions: state.positions || {},
    positionCount: Object.keys(state.positions || {}).length,
    tradeCount: (state.trades || []).length,
    dynamicOrderUsd: runtime.lastDynamicOrderUsd || 0,
    accountTotalUsd,
    maxExposureUsd,
    maxExposurePerMarketUsd,
    minLiquidityUsd,
    avgEntryPrice,
    avgOdds,
    winRate,
    settledCount,
    wonCount,
    lastScan: runtime.lastScan || null,
    updatedAt: state.updatedAt || null,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function openInDefaultBrowser(url, logger) {
  let cmd = null;
  let args = [];

  if (process.platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (process.platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", (err) => {
      logger.warn("auto-open browser failed", { message: err.message });
    });
    child.unref();
  } catch (err) {
    logger.warn("auto-open browser failed", { message: err.message });
  }
}

function startWebServer(runtime, logger) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/") {
        const html = fs.readFileSync(htmlPath, "utf8");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        json(res, 200, deriveStatus(runtime));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/trades") {
        const state = readState();
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
        const trades = (state.trades || []).slice(-limit).reverse();
        json(res, 200, { trades });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/config") {
        json(res, 200, getDashboardConfig());
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/config") {
        const raw = await readBody(req);
        const incoming = JSON.parse(raw || "{}");
        const updates = {};
        for (const key of editableKeys) {
          if (Object.prototype.hasOwnProperty.call(incoming, key)) updates[key] = incoming[key];
        }
        updateEnvValues(updates);
        json(res, 200, {
          ok: true,
          message: "配置已保存到 .env（请手动重启生效）",
        });
        return;
      }

      json(res, 404, { error: "not found" });
    } catch (err) {
      json(res, 500, { error: err.message });
    }
  });

  server.on("error", (err) => {
    logger.error("dashboard failed", { message: err.message });
  });

  server.listen(config.webPort, config.webHost, () => {
    const url = `http://${config.webHost}:${config.webPort}`;
    logger.info("dashboard started", {
      url,
    });
    if (config.webAutoOpen) {
      openInDefaultBrowser(url, logger);
    }
  });

  return server;
}

module.exports = { startWebServer };
