import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const transactions = sqliteTable('transactions', {
  hash: text('hash').primaryKey(),
  firstSeenMs: integer('first_seen_ms').notNull(),
  status: text('status', { enum: ['pending','included','dropped'] }).notNull(),
  includedBlock: integer('included_block'),
  includedAtMs: integer('included_at_ms'),
  fromAddr: text('from_addr'),
  toAddr: text('to_addr'),
  valueWei: text('value_wei'),
  feeWei: text('fee_wei'),
});

export const idxTime = sql`CREATE INDEX IF NOT EXISTS idx_tx_time ON transactions(first_seen_ms DESC, hash)`;
export const idxFrom = sql`CREATE INDEX IF NOT EXISTS idx_from ON transactions(from_addr)`;
export const idxTo   = sql`CREATE INDEX IF NOT EXISTS idx_to ON transactions(to_addr)`;
