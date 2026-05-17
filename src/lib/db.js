import { MongoClient } from "mongodb";
import { cfg } from "./config.js";
import { log, safeErr } from "./logger.js";

let client = null;
let db = null;

export async function connectDb() {
  if (db) return db;

  try {
    client = new MongoClient(cfg.MONGODB_URI, {
      maxPoolSize: 5,
      ignoreUndefined: true,
    });
    await client.connect();
    db = client.db();
    log.info("db connected", { MONGODB_URI_set: Boolean(cfg.MONGODB_URI) });
    await ensureIndexes();
    return db;
  } catch (err) {
    log.error("db connect failed", {
      collection: "system",
      operation: "connect",
      err: safeErr(err),
    });
    throw err;
  }
}

export function getDb() {
  if (!db) throw new Error("Database is not connected");
  return db;
}

export async function closeDb() {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
}

async function ensureIndexes() {
  try {
    await db.collection("alertedTokens").createIndex(
      { chain: 1, tokenAddress: 1 },
      { unique: true, name: "unique_chain_token" }
    );
    await db.collection("alertedTokens").createIndex(
      { createdAt: -1 },
      { name: "created_at_desc" }
    );
    await db.collection("scannerState").createIndex(
      { key: 1 },
      { unique: true, name: "unique_state_key" }
    );
  } catch (err) {
    log.error("db index failed", {
      collection: "alertedTokens,scannerState",
      operation: "createIndex",
      err: safeErr(err),
    });
    throw err;
  }
}

export async function countAlerts() {
  try {
    return await getDb().collection("alertedTokens").countDocuments({});
  } catch (err) {
    log.error("db count failed", {
      collection: "alertedTokens",
      operation: "countDocuments",
      err: safeErr(err),
    });
    return 0;
  }
}

export async function saveAlertIfNew(alert) {
  const mutable = { ...alert };
  delete mutable._id;
  delete mutable.createdAt;

  try {
    const now = new Date();
    const result = await getDb().collection("alertedTokens").updateOne(
      {
        chain: alert.chain,
        tokenAddress: alert.tokenAddress,
      },
      {
        $setOnInsert: {
          chain: alert.chain,
          tokenAddress: alert.tokenAddress,
          pairAddress: alert.pairAddress || "",
          symbol: alert.symbol || "",
          name: alert.name || "",
          marketCap: alert.marketCap ?? null,
          liquidity: alert.liquidity ?? null,
          sourceUrls: alert.sourceUrls || {},
          firstSeenAt: alert.firstSeenAt || now,
          createdAt: now,
        },
        $set: {
          ...mutable,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    return result.upsertedCount === 1;
  } catch (err) {
    if (err?.code === 11000) return false;
    log.error("db write failed", {
      collection: "alertedTokens",
      operation: "updateOne",
      err: safeErr(err),
    });
    throw err;
  }
}

export async function getScannerState() {
  try {
    return await getDb().collection("scannerState").findOne({ key: "scanner" });
  } catch (err) {
    log.error("db read failed", {
      collection: "scannerState",
      operation: "findOne",
      err: safeErr(err),
    });
    return null;
  }
}

export async function updateScannerState(fields) {
  const mutable = { ...fields };
  delete mutable._id;
  delete mutable.createdAt;

  try {
    await getDb().collection("scannerState").updateOne(
      { key: "scanner" },
      {
        $setOnInsert: {
          key: "scanner",
          },
        $set: {
          ...mutable,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    log.error("db write failed", {
      collection: "scannerState",
      operation: "updateOne",
      err: safeErr(err),
    });
  }
}
