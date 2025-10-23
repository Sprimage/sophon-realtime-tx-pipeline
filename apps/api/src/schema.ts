import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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


