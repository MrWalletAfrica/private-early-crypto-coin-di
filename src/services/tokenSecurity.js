import { log, safeErr } from "../lib/logger.js";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000001",
]);

function isBurnAddress(value) {
  return BURN_ADDRESSES.has(String(value || "").toLowerCase());
}

async function fetchSecurity(chainId, tokenAddress) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${encodeURIComponent(tokenAddress)}`;

  log.info("external api call start", {
    service: "GoPlus",
    feature: "token-security",
    chainId,
  });

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    log.info("external api call success", {
      service: "GoPlus",
      feature: "token-security",
      chainId,
    });

    const result = json?.result || {};
    return result[String(tokenAddress).toLowerCase()] || result[tokenAddress] || null;
  } catch (err) {
    log.warn("external api call failed", {
      service: "GoPlus",
      feature: "token-security",
      chainId,
      err: safeErr(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function verifyRenounced(sec) {
  const owner = String(sec?.owner_address || "").toLowerCase();
  const hiddenOwner = String(sec?.hidden_owner || "");
  const canTakeBack = String(sec?.can_take_back_ownership || "");

  if (!owner) {
    return {
      ok: false,
      status: "unverifiable",
      detail: "Owner address missing from security source",
    };
  }

  if (hiddenOwner === "1" || canTakeBack === "1") {
    return {
      ok: false,
      status: "not-renounced",
      detail: "Hidden owner or take-back ownership risk detected",
    };
  }

  if (isBurnAddress(owner)) {
    return {
      ok: true,
      status: "renounced",
      detail: `Owner is ${owner}`,
    };
  }

  return {
    ok: false,
    status: "not-renounced",
    detail: `Owner is ${owner}`,
  };
}

function percentValue(holder) {
  const raw = holder?.percent ?? holder?.balance_percent ?? holder?.share;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

function isLockedHolder(holder) {
  const tag = String(holder?.tag || holder?.address_tag || "").toLowerCase();
  return (
    String(holder?.is_locked || "") === "1" ||
    isBurnAddress(holder?.address) ||
    tag.includes("lock") ||
    tag.includes("burn") ||
    tag.includes("dead")
  );
}

function verifyLiquidityLocked(sec) {
  const holders = Array.isArray(sec?.lp_holders) ? sec.lp_holders : [];
  if (!holders.length) {
    return {
      ok: false,
      status: "unverifiable",
      lockedPercent: 0,
      detail: "LP holder data missing from security source",
    };
  }

  const lockedPercent = holders.reduce((sum, holder) => {
    return sum + (isLockedHolder(holder) ? percentValue(holder) : 0);
  }, 0);

  if (lockedPercent >= 0.95) {
    return {
      ok: true,
      status: "locked",
      lockedPercent,
      detail: `${Math.round(lockedPercent * 10000) / 100}% of LP appears locked or burned`,
    };
  }

  return {
    ok: false,
    status: "not-locked",
    lockedPercent,
    detail: `Only ${Math.round(lockedPercent * 10000) / 100}% of LP appears locked or burned`,
  };
}

export async function verifyTokenSecurity(candidate) {
  const sec = await fetchSecurity(candidate.chainId, candidate.tokenAddress);

  if (!sec) {
    return {
      ok: false,
      reason: "Security data missing",
      renounced: { ok: false, status: "unverifiable" },
      liquidityLock: { ok: false, status: "unverifiable" },
      honeypot: "unknown",
    };
  }

  const honeypotRisk =
    String(sec?.is_honeypot || "") === "1" ||
    String(sec?.honeypot_with_same_creator || "") === "1";

  const renounced = verifyRenounced(sec);
  const liquidityLock = verifyLiquidityLocked(sec);

  return {
    ok: !honeypotRisk && renounced.ok && liquidityLock.ok,
    reason: honeypotRisk
      ? "Honeypot warning detected"
      : !renounced.ok
        ? renounced.detail
        : !liquidityLock.ok
          ? liquidityLock.detail
          : "All required criteria verified",
    renounced,
    liquidityLock,
    honeypot: honeypotRisk ? "warning" : "clear",
  };
}
