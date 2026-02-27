const { config } = require("./config");
const { execFileSync } = require("child_process");

function parseMaybeJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeMarket(market) {
  const outcomes = parseMaybeJson(market.outcomes);
  const outcomePrices = parseMaybeJson(market.outcomePrices);
  const clobTokenIds = parseMaybeJson(market.clobTokenIds);
  const liquidity = toNum(market.liquidityNum ?? market.liquidity ?? market.scaledLiquidity) ?? 0;

  const legs = outcomes.map((name, idx) => {
    const price = toNum(outcomePrices[idx]);
    const tokenId = clobTokenIds[idx];
    if (price == null || tokenId == null) return null;
    return {
      outcome: String(name),
      price,
      tokenId: String(tokenId),
    };
  }).filter(Boolean);

  return {
    id: String(market.id ?? ""),
    question: market.question || market.title || "Unknown Market",
    slug: market.slug || "",
    liquidity,
    active: !!market.active,
    closed: !!market.closed,
    endDate: market.endDate || market.end_date || null,
    legs,
  };
}

async function fetchMarketsPage(offset = 0) {
  const url = new URL("/markets", config.gammaBaseUrl);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(config.gammaPageSize));
  url.searchParams.set("offset", String(offset));

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json.map(normalizeMarket);
}

function fetchMarketsPageByCurl(offset = 0) {
  const url = new URL("/markets", config.gammaBaseUrl);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(config.gammaPageSize));
  url.searchParams.set("offset", String(offset));

  const args = ["-sS", "-L", "--max-time", "20", String(url)];
  if (config.gammaCurlProxy) {
    args.unshift(config.gammaCurlProxy);
    args.unshift("-x");
  }
  let out;
  try {
    out = execFileSync("curl", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    if (err && err.code === "ENOBUFS") {
      throw new Error(
        "curl output too large (ENOBUFS). Reduce GAMMA_PAGE_SIZE (e.g. 50) or switch GAMMA_TRANSPORT=fetch",
      );
    }
    throw err;
  }

  const json = JSON.parse(out);
  if (!Array.isArray(json)) return [];
  return json.map(normalizeMarket);
}

async function fetchMarketsPageWithTransport(offset = 0) {
  if (config.gammaTransport === "fetch") {
    return fetchMarketsPage(offset);
  }
  if (config.gammaTransport === "curl") {
    return fetchMarketsPageByCurl(offset);
  }
  try {
    return await fetchMarketsPage(offset);
  } catch {
    return fetchMarketsPageByCurl(offset);
  }
}

async function fetchAllMarkets(maxPages = 3) {
  const all = [];
  for (let i = 0; i < maxPages; i += 1) {
    const offset = i * config.gammaPageSize;
    const page = await fetchMarketsPageWithTransport(offset);
    all.push(...page);
    if (page.length < config.gammaPageSize) break;
  }
  return all;
}

module.exports = { fetchAllMarkets };
