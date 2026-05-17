export default function register(bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      [
        "Crypto Sentinel is running.",
        "",
        "I privately scan Ethereum and BNB Smart Chain for newly launched tokens where all required criteria are positively verified:",
        "1) Market cap or FDV below $2,000",
        "2) Ownership renounced",
        "3) Liquidity locked",
        "",
        "Use /help for commands and limitations."
      ].join("\n")
    );
  });
}
