import { log, safeErr } from "../lib/logger.js";

const DEX_BASE = "https://api.dexscreener.com";
const SUPPORTED = new Map([
  ["ethereum", { id: "ethereum", name: "Ethereum", chainId: 1 }],
  ["bsc", { id: "bsc", name: "BNB Smart Chain", chainId: 56 }],
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, meta = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  log.info("external api call start", { service: "DexScreener", ...meta });

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    log.info("external api call success", { service: "DexScreener", ...meta });
    return json;
  } catch (err) {
    log.warn("external api call failed", {
      service: "DexScreener",
      ...meta,
      err: safeErr(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function marketCapOf(pair) {
  const mc = Number(pair?.marketCap);
  if (Number.isFinite(mc) && mc > 0) return mc;

  const fdv = Number(pair?.fdv);
  if (Number.isFinite(fdv) && fdv > 0) return fdv;

  return null;
}

function pairAgeMs(pair) {
  const createdAt = Number(pair?.pairCreatedAt || 0);
  if (!Number.isFinite(createdAt) || createdAt <= 0) return Number.MAX_SAFE_INTEGER;
  return Date.now() - createdAt;
}

function normalizePair(pair) {
  const chain = SUPPORTED.get(String(pair?.chainId || "").toLowerCase());
  if (!chain) return null;

  const tokenAddress = String(pair?.baseToken?.address || "").toLowerCase();
  if (!tokenAddress) return null;

  const marketCap = marketCapOf(pair);

  return {
    chain: chain.id,
    chainName: chain.name,
    chainId: chain.chainId,
    tokenAddress,
    pairAddress: String(pair?.pairAddress || "").toLowerCase(),
    name: String(pair?.baseToken?.name || "Unknown"),
    symbol: String(pair?.baseToken?.symbol || "UNKNOWN"),
    marketCap,
    liquidity: Number(pair?.liquidity?.usd || 0) || null,
    dexId: String(pair?.dexId || ""),
    url: String(pair?.url || ""),
    firstSeenAt: pair?.pairCreatedAt ? new Date(Number(pair.pairCreatedAt)) : new Date(),
  };
}

export async function discoverRecentPairs() {
  const candidates = [];

  try {
    const profiles = await fetchJson(`${DEX_BASE}/token-profiles/latest/v1`, {
      feature: "latest-token-profiles",
    });

    const rows = Array.isArray(profiles) ? profiles : [];
    const supportedProfiles = rows
      .filter((p) => SUPPORTED.has(String(p?.chainId || "").toLowerCase()))
      .slice(0, 40);

    for (const profile of supportedProfiles) {
      const chainId = String(profile.chainId || "").toLowerCase();
      const tokenAddress = String(profile.tokenAddress || "").toLowerCase();
      if (!chainId || !tokenAddress) continue;

      try {
        await sleep(150);
        const data = await fetchJson(
          `${DEX_BASE}/latest/dex/tokens/${encodeURIComponent(tokenAddress)}`,
          { feature: "token-pairs", chain: chainId }
        );

        const bestPair = (Array.isArray(data?.pairs) ? data.pairs : [])
          .filter((p) => String(p?.chainId || "").toLowerCase() === chainId)
          .sort((a, b) => pairAgeMs(a) - pairAgeMs(b))[0];

        const candidate = normalizePair(bestPair);
        if (candidate) candidates.push(candidate);
      } catch {
        continue;
      }
    }
  } catch {
    return [];
  }

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.chain}:${candidate.tokenAddress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
