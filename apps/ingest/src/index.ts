import 'dotenv/config';
import { createServer } from 'node:http';
import { CFG } from './config';
import { BlockFetcher } from './blockFetcher';
import { WSClient } from './wsClient';
import { registry } from './metrics';
import pino from 'pino';
import { getStats } from './queue';

const log = pino({ name: 'ingest' });

async function main() {
  const fetcher = new BlockFetcher(CFG.http);
  const ws = new WSClient(CFG.wss, fetcher, CFG.backoffMs);
  ws.start().catch(err => log.error({ err }, 'ws failed'));

  // periodic info log of delivery stats (from redis publisher)
  let lastLoggedTotal = 0;
  setInterval(() => {
    const { seenPending, seenIncluded } = getStats();
    const total = seenPending + seenIncluded;
    if (total - lastLoggedTotal >= 50) {
      log.info({ seenPending, seenIncluded, total }, 'ingest delivered');
      lastLoggedTotal = total;
    }
  }, 2000);

  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/metrics')) {
      const body = await registry.metrics();
      res.writeHead(200, { 'Content-Type': registry.contentType }); res.end(body); return;
    }
    if (req.url?.startsWith('/healthz')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const { seenPending, seenIncluded } = getStats();
      res.end(JSON.stringify({ status: 'ok',  seenPending, seenIncluded })); return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(CFG.port, () => log.info({ port: CFG.port }, 'ingest up'));
}
main().catch(err => { log.error({ err }, 'fatal'); process.exit(1); });
