import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const upsertsTotal = new Counter({
  name: 'indexer_upserts_total', help: 'Rows upserted (insert or upgrade)', registers: [registry],
});
export const upgradesTotal = new Counter({
  name: 'indexer_upgrades_total', help: 'pending -> included upgrades', registers: [registry],
});
export const ingestToPersistMs = new Histogram({
  name: 'ingest_to_persist_ms_bucket',
  help: 'firstSeenMs -> time of DB write',
  buckets: [50,100,250,500,1000,2000,5000], registers: [registry],
});
export const pendingToIncludedMs = new Histogram({
  name: 'pending_to_included_ms_bucket',
  help: 'firstSeenMs -> includedAtMs at upgrade',
  buckets: [100,300,1000,3000,10000,30000,60000], registers: [registry],
});
