import { Bot } from "grammy";
import { cfg } from "./lib/config.js";
import { log, safeErr } from "./lib/logger.js";

function isAuthorized(ctx) {
  return String(ctx.from?.id || "") === cfg.ADMIN_TELEGRAM_ID;
}

export function createBot(token) {
  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    if (!ctx.from) return next();

    if (!isAuthorized(ctx)) {
      try {
        await ctx.reply("Access denied.");
      } catch (err) {
        log.warn("telegram denial send failed", { err: safeErr(err) });
      }
      return;
    }

    return next();
  });

  bot.catch((err) => {
    log.error("telegram bot error", {
      err: safeErr(err.error || err),
      updateId: err.ctx?.update?.update_id,
    });
  });

  return bot;
}
