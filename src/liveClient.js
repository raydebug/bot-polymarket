const { config } = require("./config");

function requireClobClient() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require("@polymarket/clob-client");
  } catch (err) {
    throw new Error(
      "missing @polymarket/clob-client. install with: npm i @polymarket/clob-client ethers",
    );
  }
}

function validateLiveConfig() {
  if (!config.live.privateKey) {
    throw new Error("POLYMARKET_PRIVATE_KEY is required in live mode");
  }
  if (!config.live.funder) {
    throw new Error("POLYMARKET_FUNDER is required in live mode");
  }
}

function buildSide(outcomeName) {
  const text = String(outcomeName || "").toLowerCase();
  if (text === "yes") return "BUY";
  if (text === "no") return "BUY";
  return "BUY";
}

async function createLiveClient() {
  validateLiveConfig();
  const mod = requireClobClient();
  const ClobClient = mod.ClobClient || mod.default || mod;
  const client = new ClobClient(
    config.live.host,
    config.live.chainId,
    config.live.privateKey,
    config.live.funder,
  );

  if (typeof client.createOrDeriveApiKey === "function") {
    await client.createOrDeriveApiKey();
  }
  return client;
}

async function placeLiveBuy(client, candidate, orderUsd) {
  const size = orderUsd / candidate.price;
  const orderArgs = {
    tokenID: candidate.tokenId,
    price: candidate.price,
    size,
    side: buildSide(candidate.outcome),
    orderType: config.live.orderType,
  };

  if (typeof client.createOrder !== "function" || typeof client.postOrder !== "function") {
    throw new Error("clob client API shape unsupported; update src/liveClient.js for your version");
  }

  const signedOrder = await client.createOrder(orderArgs);
  const result = await client.postOrder(signedOrder, config.live.orderType);
  return { size, result };
}

function normalizeUsdBalance(payload) {
  if (payload == null) return null;
  if (typeof payload === "number") return Number.isFinite(payload) ? payload : null;
  if (typeof payload === "string") {
    const n = Number(payload);
    return Number.isFinite(n) ? n : null;
  }
  const direct =
    payload.balance ??
    payload.usdc ??
    payload.available ??
    payload.availableBalance ??
    payload.total ??
    payload.value;
  if (direct != null) return normalizeUsdBalance(direct);
  return null;
}

async function getLiveAccountTotalUsd(client) {
  if (typeof client.getBalanceAllowance === "function") {
    const v = normalizeUsdBalance(await client.getBalanceAllowance());
    if (v != null) return v;
  }
  if (typeof client.getBalance === "function") {
    const v = normalizeUsdBalance(await client.getBalance());
    if (v != null) return v;
  }
  throw new Error("cannot read live account balance from clob client");
}

module.exports = {
  createLiveClient,
  placeLiveBuy,
  getLiveAccountTotalUsd,
};
