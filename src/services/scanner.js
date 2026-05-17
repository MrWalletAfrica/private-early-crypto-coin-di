import { cfg } from "../lib/config.js";
import {
  countAlerts,
  getScannerState,
  saveAlertIfNew,
  updateScannerState,
} from "../lib/db.js";
import { log, safeErr } from "../lib/logger.js";
import { sendAlert } from "./alerts.js";
import { discoverRecentPairs } from "./marketData.js";
import { verifyTokenSecurity } from "./tokenSecurity.js";

const MARKET_CAP_LIMIT = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createScanner({ bot }) {
  let running = false;
  let cycleRunning = false;
  let stopped = false;
  let startedAt = null;
  let lastScanAt = null;
  let lastError = "";
  let lastMemoryLogAt = 0;

  async function cycle(reason = "scheduled") {
    if (cycleRunning) {
      log.warn("scanner cycle skipped", { reason, skippedReason: "already-running" });
      return { candidatesChecked: 0, alertsSent: 0, skipped: true };
    }

    cycleRunning = true;
    const started = Date.now();
    let candidatesChecked = 0;
    let alertsSent = 0;

    log.info("scanner cycle start", { reason });

    try {
      const candidates = await discoverRecentPairs();

      for (const candidate of candidates) {
        candidatesChecked += 1;

        if (candidate.marketCap === null || candidate.marketCap >= MARKET_CAP_LIMIT) {
          continue;
        }

        let security;
        try {
          security = await verifyTokenSecurity(candidate);
        } catch (err) {
          lastError = safeErr(err);
          continue;
        }

        if (!security.ok) continue;

        const isNew = await saveAlertIfNew({
          chain: candidate.chain,
          tokenAddress: candidate.tokenAddress,
          pairAddress: candidate.pairAddress,
          symbol: candidate.symbol,
          name: candidate.name,
          marketCap: candidate.marketCap,
          liquidity: candidate.liquidity,
          sourceUrls: {
            dex: candidate.url,
            security: "https://gopluslabs.io/",
          },
          firstSeenAt: candidate.firstSeenAt,
          renouncedStatus: security.renounced.status,
          liquidityLockStatus: security.liquidityLock.status,
          lockedPercent: security.liquidityLock.lockedPercent,
        });

        if (!isNew) continue;

        const sent = await sendAlert(bot, candidate, security);
        if (sent) alertsSent += 1;
      }

      lastScanAt = new Date();
      lastError = "";
      await updateScannerState({
        running,
        lastScanAt,
        lastError,
        lastCandidatesChecked: candidatesChecked,
        lastAlertsSent: alertsSent,
      });

      log.info("scanner cycle finish", {
        reason,
        candidatesChecked,
        alertsSent,
        ms: Date.now() - started,
      });

      return { candidatesChecked, alertsSent, skipped: false };
    } catch (err) {
      lastError = safeErr(err);
      await updateScannerState({ running, lastError });
      log.error("scanner cycle failed", {
        reason,
        candidatesChecked,
        alertsSent,
        err: lastError,
      });
      return { candidatesChecked, alertsSent, skipped: false, error: lastError };
    } finally {
      cycleRunning = false;
    }
  }

  async function loop() {
    running = true;
    startedAt = new Date();
    await updateScannerState({ running, startedAt, scanIntervalMs: cfg.SCAN_INTERVAL_MS });
    log.info("scanner polling started", { scanIntervalMs: cfg.SCAN_INTERVAL_MS });

    while (!stopped) {
      await cycle("scheduled");

      const now = Date.now();
      if (now - lastMemoryLogAt > 60000) {
        const m = process.memoryUsage();
        log.info("memory", {
          rssMB: Math.round(m.rss / 1e6),
          heapUsedMB: Math.round(m.heapUsed / 1e6),
        });
        lastMemoryLogAt = now;
      }

      await sleep(cfg.SCAN_INTERVAL_MS);
    }

    running = false;
    await updateScannerState({ running });
  }

  return {
    start() {
      if (running) return;
      stopped = false;
      loop().catch((err) => {
        lastError = safeErr(err);
        log.error("scanner loop failed", { err: lastError });
      });
    },

    stop() {
      stopped = true;
    },

    scanNow() {
      return cycle("manual");
    },

    async getStatus() {
      const saved = await getScannerState();
      return {
        running,
        cycleRunning,
        startedAt,
        lastScanAt: lastScanAt || saved?.lastScanAt || null,
        scanIntervalMs: cfg.SCAN_INTERVAL_MS,
        totalAlerts: await countAlerts(),
        lastError: lastError || saved?.lastError || "",
      };
    },
  };
}
