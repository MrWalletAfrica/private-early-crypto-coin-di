import { cfg } from "../lib/config.js";
import { log, safeErr } from "../lib/logger.js";

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "unknown";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatAlert(candidate, security) {
  return [
    "Crypto Sentinel alert",
    "",
    `${candidate.name} (${candidate.symbol})`,
    `Chain: ${candidate.chainName}`,
    `Token: ${candidate.tokenAddress}`,
    `Pair: ${candidate.pairAddress || "unknown"}`,
    `Market cap or FDV: ${money(candidate.marketCap)}`,
    `Liquidity: ${money(candidate.liquidity)}`,
    `Ownership: ${security.renounced.status}`,
    `Liquidity lock: ${security.liquidityLock.status}`,
    candidate.url ? `DEX link: ${candidate.url}` : "DEX link: unavailable",
    "",
    "Informational only. This is not financial advice. Low market cap and locked liquidity do not make a token safe.",
  ].join("\n");
}

export async function sendAlert(bot, candidate, security) {
  try {
    await bot.api.sendMessage(cfg.ADMIN_TELEGRAM_ID, formatAlert(candidate, security), {
      disable_web_page_preview: true,
    });
    return true;
  } catch (err) {
    log.error("telegram send failed", {
      feature: "token-alert",
      err: safeErr(err),
    });
    return false;
  }
}
