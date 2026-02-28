const { loadEnvFile } = require("./loadEnv");
loadEnvFile();

const logger = require("./logger");
const { config } = require("./config");
const { startWebServer } = require("./webServer");

startWebServer({
  lastDynamicOrderUsd: 0,
  lastAccountTotalUsd: null,
  lastScan: null,
}, logger);

logger.info("web-only mode", { host: config.webHost, port: config.webPort });
