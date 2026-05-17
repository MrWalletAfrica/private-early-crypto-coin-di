export default function register(bot, { scanner }) {
  bot.command("status", async (ctx) => {
    const status = await scanner.getStatus();
    const lastScan = status.lastScanAt
      ? new Date(status.lastScanAt).toISOString()
      : "never";

    await ctx.reply(
      [
        "Crypto Sentinel status",
        "",
        `Scanner running: ${status.running ? "yes" : "no"}`,
        `Cycle active: ${status.cycleRunning ? "yes" : "no"}`,
        `Last scan: ${lastScan}`,
        `Scan interval: ${status.scanIntervalMs} ms`,
        `Total saved alerts: ${status.totalAlerts}`,
        `Last critical error: ${status.lastError || "none"}`,
      ].join("\n")
    );
  });
}
