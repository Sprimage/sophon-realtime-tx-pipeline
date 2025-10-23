export const CFG = {
    wss: process.env.SOPHON_WSS!,
    http: process.env.SOPHON_HTTP!,
    port: Number(process.env.PORT ?? 4001),
  
    backoffMs: { base: 1000, max: 15000 },  
    batchSize: 200,                          
  };
  if (!CFG.wss || !CFG.http) throw new Error('Missing SOPHON_WSS/SOPHON_HTTP in env');
  