export default function register(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "Crypto Sentinel commands:",
        "",
        "/start - Show the private bot introduction",
        "/help - Show commands, criteria, and supported chains",
        "/status - Show scanner status, last scan, interval, saved alerts, and last error",
        "/scan - Trigger one immediate manual scan",
        "",
        "Criteria:",
        "1) Market cap or FDV must be available and below $2,000",
        "2) Ownership must be positively verified as renounced",
        "3) Liquidity must be positively verified as locked",
        "",
        "Supported chains: Ethereum and BNB Smart Chain.",
        "If any criterion cannot be verified, the token is skipped.",
        "Informational only. Not financial advice."
      ].join("\n")
    );
  });
}
