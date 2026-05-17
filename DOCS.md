Crypto Sentinel is a private Telegram bot for one owner. It scans Ethereum and BNB Smart Chain for newly launched tokens and only sends an alert when all required criteria are positively verified.

Public commands:

1) /start
Shows the private bot introduction and explains what Crypto Sentinel scans for.
Usage: /start

2) /help
Shows commands, scan criteria, supported chains, and the financial risk notice.
Usage: /help

3) /status
Shows whether the scanner is running, whether a cycle is active, last scan time, scan interval, total saved alerts, and last critical error.
Usage: /status

4) /scan
Triggers one manual scan immediately and reports how many candidates were checked and how many alerts were sent.
Usage: /scan

Access control:
Only the configured owner can use the bot. By default, the owner is Telegram user ID 580632670. You can override it with ADMIN_TELEGRAM_ID. Unauthorized users receive only a short denial message and no scanner details.

Environment variables:

1) TELEGRAM_BOT_TOKEN
Required. Telegram bot token from BotFather.

2) MONGODB_URI
Required. MongoDB connection string used to store alerted tokens and scanner state.

3) ADMIN_TELEGRAM_ID
Optional. Defaults safely to 580632670.

4) SCAN_INTERVAL_MS
Optional. Defaults safely to 60000 milliseconds when missing or invalid.

Scanner criteria:
The bot only alerts when all of these are true:

1) Market cap or FDV is available and below $2,000.

2) Ownership is positively verified as renounced.

3) Liquidity is positively verified as locked.

The bot skips tokens with missing market cap, missing pair data, honeypot warnings, unverifiable ownership, unverifiable liquidity, active ownership, or unlocked liquidity.

Data sources:
Crypto Sentinel uses DexScreener public token and pair data for discovery and market data. It uses GoPlus Security public token security data for ownership, honeypot, and liquidity lock verification.

Database collections:

1) alertedTokens
Stores chain, tokenAddress, pairAddress, symbol, name, marketCap, liquidity, source URLs, firstSeenAt, createdAt, and updatedAt. A unique index on chain plus tokenAddress prevents duplicate alerts.

2) scannerState
Stores scanner running state, last scan time, scan interval, last checked counts, and last error.

Operational notes:
The scanner runs inside the same Node.js process as the Telegram bot. There is no separate worker or queue. The scanner uses a non-overlapping polling loop and sleeps after each cycle.

Limitations:
The bot only alerts when external data sources positively verify all requested criteria. Renounced ownership and locked liquidity checks depend on third-party and on-chain data availability. Market cap below $2,000 and locked liquidity do not make a token safe. This bot is informational only and not financial advice.

Setup:
Install dependencies with npm install. Copy .env.sample to .env and fill TELEGRAM_BOT_TOKEN and MONGODB_URI. Run npm run dev locally or npm start in production.

Deployment:
On Render or a similar host, set TELEGRAM_BOT_TOKEN and MONGODB_URI. The build command is npm run build and the start command is npm start. The bot uses long polling and clears webhooks on startup.

Troubleshooting:
If the bot exits immediately, confirm TELEGRAM_BOT_TOKEN and MONGODB_URI are set. If alerts are missing, check /status and logs. Missing alerts usually mean one of the required criteria could not be positively verified by the public data sources.
