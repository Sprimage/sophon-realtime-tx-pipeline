import 'dotenv/config';
import { createServer } from 'node:http';
import { CFG } from './config';
import { BlockFetcher } from './blockFetcher';
import { WSClient } from './wsClient';
import { registry } from './metrics';
import pino from 'pino';
import { queue } from './queue';

const log = pino({ name: 'ingest' });

async function main() {
  const fetcher = new BlockFetcher(CFG.http);
  const ws = new WSClient(CFG.wss, fetcher, CFG.backoffMs);
  ws.start().catch(err => log.error({ err }, 'ws failed'));

  let seenPending = 0;
  let seenIncluded = 0;
  queue.on(async (batch) => {
    for (const e of batch) {
      if (e.status === 'pending') seenPending++;
      if (e.status === 'included') seenIncluded++;
    }
    // print every 50 events to avoid spam
    const total = seenPending + seenIncluded;
    if (total % 50 === 0) {
      log.info({ seenPending, seenIncluded, total }, 'ingest delivered');
    }
  });

  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/metrics')) {
      const body = await registry.metrics();
      res.writeHead(200, { 'Content-Type': registry.contentType }); res.end(body); return;
    }
    if (req.url?.startsWith('/healthz')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok',  seenPending, seenIncluded })); return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(CFG.port, () => log.info({ port: CFG.port }, 'ingest up'));
}
main().catch(err => { log.error({ err }, 'fatal'); process.exit(1); });
