export const CFG = {
    wss: process.env.SOPHON_WSS!,
    http: process.env.SOPHON_HTTP!,
    port: Number(process.env.PORT ?? 4001),
  
    backoffMs: { base: 1000, max: 15000 },  
    batchSize: 200,                          

    redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    stream: process.env.INGEST_STREAM ?? 'ingest:tx',
  };
  if (!CFG.wss || !CFG.http) throw new Error('Missing SOPHON_WSS/SOPHON_HTTP in env');
  