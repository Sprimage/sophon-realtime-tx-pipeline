import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const wsConnected = new Gauge({
    name: 'ws_connected',
    help: '1 when WS connected (heads path), 0 otherwise',
    registers: [registry],
  });
  
  export const wsPendingConnected = new Gauge({
    name: 'ws_pending_connected',
    help: '1 when WS connected (pending path), 0 otherwise',
    registers: [registry],
  });

export const pendingSeenTotal = new Counter({
  name: 'pending_seen_total',
  help: 'Count of pending tx hashes observed',
  registers: [registry],
});

export const includedSeenTotal = new Counter({
  name: 'included_seen_total',
  help: 'Count of included txs observed (from blocks)',
  registers: [registry],
});

export const ingestToQueueMs = new Histogram({
  name: 'ingest_to_queue_ms_bucket',
  help: 'Latency from header seen to tx enqueued (included path)',
  buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000],
  registers: [registry],
});

export const pendingToIncludedMs = new Histogram({
  name: 'pending_to_included_ms_bucket',
  help: 'Time from pending first seen to inclusion',
  buckets: [100, 300, 1000, 3000, 10000, 30000, 60000, 120000],
  registers: [registry],
});


