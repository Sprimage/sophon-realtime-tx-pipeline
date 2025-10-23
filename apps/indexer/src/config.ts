import os from 'node:os';

export const CFG = {
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  stream: process.env.INGEST_STREAM ?? 'ingest:tx',
  group: process.env.INDEXER_GROUP ?? 'indexer',
  consumer: process.env.CONSUMER_NAME ?? os.hostname(),
  batchSize: Number(process.env.CONSUME_BATCH ?? 200),
};

