export default function register(bot, { scanner }) {
  bot.command("scan", async (ctx) => {
    await ctx.reply("Manual scan started. I will report back when this cycle finishes.");

    const result = await scanner.scanNow();

    if (result.skipped) {
      await ctx.reply("A scan is already running. Try again in a moment.");
      return;
    }

    await ctx.reply(
      [
        "Manual scan finished.",
        `Candidates checked: ${result.candidatesChecked}`,
        `Alerts sent: ${result.alertsSent}`,
        result.error ? `Error: ${result.error}` : "Error: none",
      ].join("\n")
    );
  });
}
