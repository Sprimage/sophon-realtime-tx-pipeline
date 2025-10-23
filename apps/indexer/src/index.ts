import 'dotenv/config';
import pino from 'pino';
import { db } from './db';
import { transactions } from './schema';
import { sql, eq } from 'drizzle-orm';
import { registry, upsertsTotal, upgradesTotal, ingestToPersistMs, pendingToIncludedMs } from './metrics';
import { createServer } from 'node:http';
import { CFG } from './config';
import { createRedisClient, ensureGroup, readAndAckLoop } from './redisConsumer';

const log = pino({ name: 'indexer' });

async function main() {
  // ensure indexes exist (MVP; later use drizzle-kit migrations)
  await db.run(sql`CREATE TABLE IF NOT EXISTS transactions (
    hash TEXT PRIMARY KEY,
    first_seen_ms INTEGER NOT NULL,
    status TEXT NOT NULL,
    included_block INTEGER,
    included_at_ms INTEGER,
    from_addr TEXT,
    to_addr TEXT,
    value_wei TEXT,
    fee_wei TEXT
  )`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions(first_seen_ms DESC, hash)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_from ON transactions(from_addr)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_to ON transactions(to_addr)`);

// ---- helper: upsert batch
async function upsertBatch(batch: any[]) {
  // separate pending vs included to compute metrics
  const now = Date.now();

  for (const e of batch) {
    if (e.status === 'pending') {
      // INSERT OR IGNORE keeps earliest firstSeenMs if duplicate
      await db.run(sql`
        INSERT OR IGNORE INTO transactions(hash, first_seen_ms, status)
        VALUES (${e.hash}, ${e.firstSeenMs}, 'pending')
      `);
      // if not ignored (new row), count as upsert
      upsertsTotal.inc();
    } else if (e.status === 'included') {
      // Upsert with upgrade: if exists (pending), preserve earliest first_seen_ms
      // Drizzle onConflictDoUpdate targets primary key (hash)
      await db
        .insert(transactions)
        .values({
          hash: e.hash,
          firstSeenMs: e.firstSeenMs, // might be newer; we preserve min() below
          status: 'included',
          includedBlock: e.includedBlock,
          includedAtMs: e.includedAtMs,
          fromAddr: e.from ?? null,
          toAddr: e.to ?? null,
          valueWei: e.valueWei ?? null,
          feeWei: e.feeWei ?? null,
        })
        .onConflictDoUpdate({
          target: transactions.hash,
          // preserve earliest firstSeenMs using MIN()
          set: {
            status: sql`'included'`,
            includedBlock: sql`${e.includedBlock}`,
            includedAtMs: sql`${e.includedAtMs}`,
            fromAddr: sql`${e.from ?? null}`,
            toAddr: sql`${e.to ?? null}`,
            valueWei: sql`${e.valueWei ?? null}`,
            feeWei: sql`${e.feeWei ?? null}`,
            firstSeenMs: sql`MIN(first_seen_ms, ${e.firstSeenMs})`,
          },
        });

      upsertsTotal.inc();
      // compute metrics
      const persistLatency = now - e.firstSeenMs;
      ingestToPersistMs.observe(persistLatency);
      if (e.includedAtMs) {
        pendingToIncludedMs.observe(e.includedAtMs - e.firstSeenMs);
        upgradesTotal.inc();
      }
    }
  }
}

  // start Redis consumer
  const redis = createRedisClient();
  await ensureGroup(redis);
  readAndAckLoop(redis, async (batch) => {
    try {
      await upsertBatch(batch);
    } catch (err) {
      log.error({ err }, 'batch upsert failed');
    }
  }).catch(err => log.error({ err }, 'consumer loop crashed'));

  // tiny metrics server (3002 default)
  const PORT = Number(process.env.INDEXER_PORT ?? 3002);
  createServer(async (_req, res) => {
    const body = await registry.metrics();
    res.writeHead(200, { 'Content-Type': registry.contentType });
    res.end(body);
  }).listen(PORT, () => log.info({ port: PORT }, 'indexer metrics up'));
}

main().catch(err => { log.error({ err }, 'fatal'); process.exit(1); });
