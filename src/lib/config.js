const DEFAULT_ADMIN_ID = "580632670";
const DEFAULT_SCAN_INTERVAL_MS = 60000;

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "",
  ADMIN_TELEGRAM_ID: String(process.env.ADMIN_TELEGRAM_ID || DEFAULT_ADMIN_ID),
  SCAN_INTERVAL_MS: parsePositiveInt(
    process.env.SCAN_INTERVAL_MS,
    DEFAULT_SCAN_INTERVAL_MS
  ),
};

export function envHealth() {
  return {
    TELEGRAM_BOT_TOKEN_set: Boolean(cfg.TELEGRAM_BOT_TOKEN),
    MONGODB_URI_set: Boolean(cfg.MONGODB_URI),
    ADMIN_TELEGRAM_ID_set: Boolean(process.env.ADMIN_TELEGRAM_ID),
    SCAN_INTERVAL_MS: cfg.SCAN_INTERVAL_MS,
  };
}
