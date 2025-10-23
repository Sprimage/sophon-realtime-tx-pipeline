import 'dotenv/config';
import express from 'express';
import pino from 'pino';
import Redis from 'ioredis';
import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { JsonRpcProvider } from 'ethers';
import { CFG } from './config';
import { transactions } from './schema';

const log = pino({ name: 'api' });

// Metrics
const registry = new Registry();
collectDefaultMetrics({ register: registry });
const apiRequestsTotal = new Counter({ name: 'api_requests_total', help: 'API requests', labelNames: ['route','code'], registers: [registry] });
const apiLatency = new Histogram({ name: 'api_latency_ms_bucket', help: 'API latency', buckets: [10,25,50,100,200,400,800], registers: [registry] });

// DB
const sqlite = new Database(CFG.dbPath);
const db = drizzle(sqlite);

// Redis stream consumer
const redis = new Redis(CFG.redisUrl);
type PendingEvt = { status: 'pending'; hash: string; firstSeenMs: number };
type IncludedEvt = { status: 'included'; hash: string; firstSeenMs: number; includedBlock: number; includedAtMs: number; from?: string; to?: string|null; valueWei?: string; feeWei?: string };
type IngestEvent = PendingEvt | IncludedEvt;

async function ensureGroup() {
  try { await redis.xgroup('CREATE', CFG.stream, CFG.group, '0', 'MKSTREAM'); }
  catch (e: any) { if (!String(e?.message??'').includes('BUSYGROUP')) throw e; }
}

// HTTP server
const app = express();

// CORS: allow all origins (dev convenience)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers') || 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/healthz', (_req, res) => { res.json({ status: 'ok', port: CFG.port }); });
app.get('/metrics', async (_req, res) => { res.set('Content-Type', registry.contentType); res.send(await registry.metrics()); });

// REST helpers
function decodeCursor(s?: string): { t: number; h: string } | undefined { if (!s) return; try { return JSON.parse(Buffer.from(s, 'base64').toString()); } catch { return; } }
function encodeCursor(c: { t: number; h: string }): string { return Buffer.from(JSON.stringify(c)).toString('base64'); }

app.get('/tx', async (req, res) => {
  const stop = apiLatency.startTimer();
  try {
    const cursor = decodeCursor(String(req.query.cursor || ''));
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const where = cursor ? or(lt(transactions.firstSeenMs, cursor.t), and(eq(transactions.firstSeenMs, cursor.t), lt(transactions.hash, cursor.h))) : undefined;
    const items = await db.select().from(transactions).where(where as any).orderBy(desc(transactions.firstSeenMs), desc(transactions.hash)).limit(limit);
    const next = items.length === limit ? encodeCursor({ t: items[items.length-1].firstSeenMs!, h: items[items.length-1].hash! }) : undefined;
    apiRequestsTotal.inc({ route: '/tx', code: 200 } as any);
    res.json({ items, nextCursor: next });
  } catch (e) {
    apiRequestsTotal.inc({ route: '/tx', code: 500 } as any);
    res.status(500).json({ error: 'internal' });
  } finally { stop(); }
});

app.get('/address/:addr/tx', async (req, res) => {
  const stop = apiLatency.startTimer();
  try {
    const addr = String(req.params.addr).toLowerCase();
    const cursor = decodeCursor(String(req.query.cursor || ''));
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const baseWhere = or(eq(transactions.fromAddr, addr), eq(transactions.toAddr, addr));
    const where = cursor ? and(baseWhere, or(lt(transactions.firstSeenMs, cursor.t), and(eq(transactions.firstSeenMs, cursor.t), lt(transactions.hash, cursor.h)))) : baseWhere;
    const items = await db.select().from(transactions).where(where as any).orderBy(desc(transactions.firstSeenMs), desc(transactions.hash)).limit(limit);
    const next = items.length === limit ? encodeCursor({ t: items[items.length-1].firstSeenMs!, h: items[items.length-1].hash! }) : undefined;
    apiRequestsTotal.inc({ route: '/address/:addr/tx', code: 200 } as any);
    res.json({ items, nextCursor: next });
  } catch (e) {
    apiRequestsTotal.inc({ route: '/address/:addr/tx', code: 500 } as any);
    res.status(500).json({ error: 'internal' });
  } finally { stop(); }
});

// Optionally serve exported dashboard (same-origin) when available
try {
  if (process.env.SERVE_DASHBOARD === '1') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const outDir = path.resolve(__dirname, '../../web/out');
    if (fs.existsSync(outDir)) {
      app.use(express.static(outDir));
      app.get('*', (_req, res) => res.sendFile(path.join(outDir, 'index.html')));
      log.info({ outDir }, 'serving dashboard');
    }
  }
} catch {}

const server = app.listen(CFG.port, () => log.info({ port: CFG.port }, 'api up'));

// Socket.IO (alternative transport for browsers/HMR conflicts)
const io = new SocketIOServer(server, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET','POST'] },
});
io.on('connection', (socket: any) => {
  log.info({ sid: socket.id }, 'io connected');
  socket.on('subscribe_address', (addr: string) => {
    if (!addr) return;
    socket.join(`addr:${addr.toLowerCase()}`);
  });
  socket.on('unsubscribe_address', (addr: string) => {
    if (!addr) return;
    socket.leave(`addr:${addr.toLowerCase()}`);
  });
  socket.on('disconnect', (reason: any) => {
    log.info({ sid: socket.id, reason }, 'io disconnected');
  });
});

// WS servers (manual upgrade routing to avoid conflicts with other libs)
const wssGlobal = new WebSocketServer({ noServer: true });
const wssAddr = new WebSocketServer({ noServer: true });

server.on('upgrade', (req: any, socket: any, head: any) => {
  try {
    const url = new URL(req.url || '', 'http://x');
    if (url.pathname === '/stream/tx') {
      wssGlobal.handleUpgrade(req, socket, head, (ws) => wssGlobal.emit('connection', ws, req));
    } else if (url.pathname === '/stream/address') {
      wssAddr.handleUpgrade(req, socket, head, (ws) => wssAddr.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  } catch {
    try { socket.destroy(); } catch {}
  }
});

function setupHeartbeat(wss: WebSocketServer, name: string) {
  wss.on('connection', (ws) => {
    (ws as unknown as { isAlive: boolean }).isAlive = true;
    ws.on('pong', () => { (ws as unknown as { isAlive: boolean }).isAlive = true; });
    log.info({ name, clients: wss.clients.size }, 'ws connected');
  });
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      const sock = ws as unknown as { isAlive?: boolean };
      if (!sock.isAlive) { try { ws.terminate(); } catch {} continue; }
      sock.isAlive = false; try { ws.ping(); } catch {}
    }
  }, 30000);
  wss.on('close', () => clearInterval(interval));
}

setupHeartbeat(wssGlobal, 'global');
setupHeartbeat(wssAddr, 'address');

// Send a greeting on connect to verify delivery path
wssGlobal.on('connection', (ws) => {
  try { ws.send(JSON.stringify({ type: 'hello', ts: Date.now() })); } catch {}
});

// Observability: log connection lifecycle for debugging
wssGlobal.on('connection', (ws) => {
  ws.on('close', (code, reason) => {
    log.info({ scope: 'global', code, reason: reason?.toString?.() }, 'ws closed');
  });
  ws.on('error', (e) => {
    log.warn({ scope: 'global', e }, 'ws error');
  });
});
wssAddr.on('connection', (ws) => {
  ws.on('close', (code, reason) => {
    log.info({ scope: 'address', code, reason: reason?.toString?.() }, 'ws closed');
  });
  ws.on('error', (e) => {
    log.warn({ scope: 'address', e }, 'ws error');
  });
});

const provider = new JsonRpcProvider(CFG.httpRpc);
const enrichCache = new Map<string, { from: string; to: string | null; valueWei: string; ts: number }>();
async function enrich(hash: string) {
  const now = Date.now();
  const c = enrichCache.get(hash); if (c && now - c.ts < 60000) return c;
  try {
    const tx = await provider.getTransaction(hash);
    if (!tx) return undefined;
    const v = { from: tx.from?.toLowerCase?.() ?? '', to: tx.to ? tx.to.toLowerCase() : null, valueWei: tx.value?.toString?.() ?? '0', ts: Date.now() };
    enrichCache.set(hash, v);
    return v;
  } catch { return undefined; }
}

// Track address subscribers
const addrSubs = new Map<string, Set<any>>();
wssAddr.on('connection', (ws, req) => {
  try {
    const url = new URL(req.url || '', 'http://x');
    const addr = (url.searchParams.get('addr') || '').toLowerCase();
    if (!addr) { ws.close(); return; }
    if (!addrSubs.has(addr)) addrSubs.set(addr, new Set());
    addrSubs.get(addr)!.add(ws);
    ws.on('close', () => addrSubs.get(addr)?.delete(ws));
    ws.on('error', () => {});
  } catch { ws.close(); }
});

function broadcastGlobal(msg: any) {
  const s = JSON.stringify(msg);
  for (const client of wssGlobal.clients) try { if (client.readyState === WebSocket.OPEN) client.send(s); } catch {}
  try { io.emit('tx_global', msg); } catch {}
}
function broadcastAddr(addr: string, msg: any) {
  const s = JSON.stringify(msg);
  const set = addrSubs.get(addr); if (!set) return;
  for (const client of set) try { if (client.readyState === WebSocket.OPEN) client.send(s); } catch {}
  try { io.to(`addr:${addr}`).emit('tx_addr', msg); } catch {}
}

// Redis loop and fanout (no top-level await for CJS)
async function startRedisLoop() {
  await ensureGroup();
  for (;;) {
    try {
      const resp = await redis.xreadgroup('GROUP', CFG.group, process.pid.toString(), 'COUNT', 200, 'BLOCK', 5000, 'STREAMS', CFG.stream, '>') as null | [string, [string, string[]][]][];
      if (!resp) continue;
      const [, entries] = resp[0];
      const parsed = (entries as [string, string[]][]) .map(([id, fields]) => {
        const idx = fields.findIndex((k) => k === 'data');
        const json = idx >= 0 ? fields[idx + 1] : '{}';
        return { id, evt: JSON.parse(json) as IngestEvent };
      });
      for (const p of parsed) {
        const e = p.evt;
        if (e.status === 'pending') {
          const h = (e.hash || '').toLowerCase();
          broadcastGlobal({ type: 'pending', tx: { hash: h, firstSeenMs: e.firstSeenMs } });
          const enr = await enrich(e.hash);
          if (enr) {
            const hLower = (e.hash || '').toLowerCase();
            if (enr.from) broadcastAddr(enr.from, { type: 'pending', tx: { hash: hLower, firstSeenMs: e.firstSeenMs, ...enr } });
            if (enr.to) broadcastAddr(enr.to, { type: 'pending', tx: { hash: hLower, firstSeenMs: e.firstSeenMs, ...enr } });
          }
        } else if (e.status === 'included') {
          const norm = {
            status: 'included' as const,
            hash: ((e as any).hash || '').toLowerCase(),
            firstSeenMs: e.firstSeenMs,
            includedBlock: e.includedBlock,
            includedAtMs: e.includedAtMs,
            from: (e as any).from ?? null,
            to: (e as any).to ?? null,
            valueWei: (e as any).valueWei ?? '0',
            feeWei: (e as any).feeWei ?? null,
          };
          broadcastGlobal({ type: 'included', tx: norm });
          // Ensure address fanout even when from/to were missing on the event
          let from = e.from?.toLowerCase?.() ?? null;
          let to = e.to?.toLowerCase?.() ?? null;
          if (!from || !to) {
            const enr = await enrich((e as any).hash);
            from = from || enr?.from || null;
            to = to || enr?.to || null;
          }
          if (from) broadcastAddr(from, { type: 'included', tx: { ...norm, from } });
          if (to) broadcastAddr(to, { type: 'included', tx: { ...norm, to } });
        }
      }
      const pipeline = redis.pipeline();
      for (const p of parsed) pipeline.xack(CFG.stream, CFG.group, p.id);
      await pipeline.exec();
    } catch (e) {
      log.warn({ e }, 'redis loop error');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

startRedisLoop().catch((e) => log.error({ e }, 'redis loop failed to start'));


