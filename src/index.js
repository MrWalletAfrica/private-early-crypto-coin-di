import "dotenv/config";
import { run } from "@grammyjs/runner";
import { createBot } from "./bot.js";
import { registerCommands } from "./commands/loader.js";
import { cfg, envHealth } from "./lib/config.js";
import { connectDb, closeDb } from "./lib/db.js";
import { log, safeErr } from "./lib/logger.js";
import { createScanner } from "./services/scanner.js";

let runner = null;
let shuttingDown = false;

process.on("unhandledRejection", (err) => {
  log.error("unhandled rejection", { err: safeErr(err) });
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  log.error("uncaught exception", { err: safeErr(err) });
  process.exit(1);
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConflict(err) {
  const text = safeErr(err).toLowerCase();
  return text.includes("409") || text.includes("conflict") || text.includes("terminated by other getupdates");
}

async function startPollingWithRetry(bot) {
  let backoffMs = 2000;

  while (!shuttingDown) {
    try {
      log.info("telegram polling preparing");
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      log.info("telegram webhook cleared", { drop_pending_updates: true });

      runner = run(bot, {
        runner: {
          fetch: {
            allowed_updates: ["message"],
          },
        },
        concurrency: 1,
      });

      log.info("telegram polling started", { concurrency: 1 });
      await runner.task();
      backoffMs = 2000;
    } catch (err) {
      const msg = safeErr(err);
      log.warn("telegram polling failed", { err: msg, conflict: isConflict(err) });

      if (runner) {
        try {
          await runner.stop();
        } catch {
          // ignore stop errors during overlap recovery
        }
        runner = null;
      }

      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs === 2000 ? 5000 : backoffMs * 2, 20000);
    }
  }
}

async function boot() {
  log.info("boot start");
  log.info("env sanity", envHealth());

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required. Add it to your environment and redeploy.");
    process.exit(1);
  }

  if (!cfg.MONGODB_URI) {
    console.error("MONGODB_URI is required. Add it to your environment and redeploy.");
    process.exit(1);
  }

  await connectDb();

  const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);
  await bot.init();

  const scanner = createScanner({ bot });
  await registerCommands(bot, { scanner });

  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Private bot introduction" },
      { command: "help", description: "Commands and scan criteria" },
      { command: "status", description: "Scanner status" },
      { command: "scan", description: "Run one manual scan" },
    ]);
  } catch (err) {
    log.warn("telegram set commands failed", { err: safeErr(err) });
  }

  scanner.start();
  await startPollingWithRetry(bot);
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("shutdown start", { signal });

  if (runner) {
    try {
      await runner.stop();
    } catch (err) {
      log.warn("runner stop failed", { err: safeErr(err) });
    }
  }

  try {
    await closeDb();
  } catch (err) {
    log.warn("db close failed", { err: safeErr(err) });
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

boot().catch((err) => {
  log.error("boot failed", { err: safeErr(err), code: err?.code });
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.error("Check that all ESM imports include .js extensions and referenced files exist.");
  }
  process.exit(1);
});
