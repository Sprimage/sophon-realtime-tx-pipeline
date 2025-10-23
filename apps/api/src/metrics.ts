import { collectDefaultMetrics, Counter, Histogram, Registry, Gauge } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const apiRequestsTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total API requests',
  labelNames: ['route', 'code'],
  registers: [registry],
});

export const apiLatencyMs = new Histogram({
  name: 'api_latency_ms_bucket',
  help: 'API latency in ms',
  buckets: [10, 25, 50, 100, 200, 400, 800, 1600],
  registers: [registry],
});

export const apiWsClients = new Gauge({
  name: 'api_ws_clients',
  help: 'Current WS clients',
  registers: [registry],
});

export const apiWsEvents = new Counter({
  name: 'api_ws_events_total',
  help: 'WS events emitted',
  labelNames: ['type'],
  registers: [registry],
});

export const enrichReqs = new Counter({
  name: 'api_pending_enrich_requests_total',
  help: 'Pending enrichment requests',
  registers: [registry],
});

export const enrichErrs = new Counter({
  name: 'api_pending_enrich_errors_total',
  help: 'Pending enrichment errors',
  registers: [registry],
});

export const enrichCacheHits = new Counter({
  name: 'api_pending_enrich_cache_hits_total',
  help: 'Pending enrichment cache hits',
  registers: [registry],
});


