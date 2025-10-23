export const CFG = {
  port: Number(process.env.API_PORT ?? 3200),
  dbPath: process.env.DATABASE_URL ?? '../../sophon-demo.sqlite',
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  stream: process.env.INGEST_STREAM ?? 'ingest:tx',
  group: process.env.API_GROUP ?? 'api',
  httpRpc: process.env.SOPHON_HTTP!,
};


