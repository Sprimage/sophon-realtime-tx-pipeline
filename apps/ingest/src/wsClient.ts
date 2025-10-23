import { WebSocketProvider } from 'ethers';
import pino from 'pino';
import WebSocket from 'ws';
import { BlockFetcher } from './blockFetcher';
import { publish } from './queue';
import { wsConnected, wsPendingConnected, pendingSeenTotal } from './metrics';

export class WSClient {
  private log = pino({ name: 'ingest:ws' });
  private fetcher: BlockFetcher;
  private wssUrl: string;
  private backoff = { base: 1000, max: 15000 };

  constructor(wssUrl: string, fetcher: BlockFetcher, backoff?: {base:number,max:number}) {
    this.wssUrl = wssUrl;
    this.fetcher = fetcher;
    if (backoff) this.backoff = backoff;
  }

  async start() {
    this.startHeadsLoop();     
    this.startPendingLoop();  
  }


  private async startHeadsLoop() {
    let delay = this.backoff.base;
    for (;;) {
      try {
        this.log.info({ wss: this.wssUrl }, 'connecting WS (heads)');
        const provider = new WebSocketProvider(this.wssUrl); 
        wsConnected.set(1);

        provider.on('block', async (blockNumber: number) => {
          try {
            const seenAtMs = Date.now();
            const batch = await this.fetcher.fetchBlockByNumberAndMap(blockNumber, seenAtMs);
            await publish(batch);
           
          } catch (err) {
            this.log.error({ err }, 'error processing block');
          }
        });

        this.log.info('WS (heads) connected');
        await new Promise((_r, rej) => {
          const ws: any = (provider as any)._websocket;
          ws?.addEventListener?.('close', () => rej(new Error('heads socket closed')));
          ws?.addEventListener?.('error', (e: any) => this.log.warn({ e }, 'heads socket error'));
        });
      } catch (e) {
        wsConnected.set(0);
        this.log.warn({ e }, 'WS (heads) disconnected, backing off...');
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, this.backoff.max);
      }
    }
  }


  private async startPendingLoop() {
    let delay = this.backoff.base;

    for (;;) {
      const ws = new WebSocket(this.wssUrl);
      let connected = false;

      const connectP = new Promise((_res, rej) => {
        ws.on('open', () => {
          connected = true;
          wsPendingConnected.set(1);
          // subscribe to pending hashes (WS-only eth_subscribe)
          ws.send(JSON.stringify({jsonrpc: "2.0",  id: 1, method: 'eth_subscribe', params: ['newPendingTransactions'] }));
          this.log.info('WS (pending) subscribed');
        });

        ws.on('message', (buf) => {
          try {
            const msg = JSON.parse(String(buf));
            if (msg.method === 'eth_subscription' && msg.params?.result) {
              const hash = msg.params.result as string;
              pendingSeenTotal.inc(1);
              publish([{ status: 'pending', hash, firstSeenMs: Date.now() }]);
            }
            if (msg.id === 1 && msg.error) {
              this.log.warn({ err: msg.error }, 'pending subscription not allowed');
              ws.close();
            }
          } catch {}
        });

        ws.on('close', () => rej(new Error('pending socket closed')));
        ws.on('error', (e) => rej(e));
      });

      try {
        await connectP;
      } catch (e) {
        if (connected) wsPendingConnected.set(0);
        this.log.warn({ e }, 'WS (pending) disconnected, backing off...');
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, this.backoff.max);
        continue;
      }
    }
  }
}
