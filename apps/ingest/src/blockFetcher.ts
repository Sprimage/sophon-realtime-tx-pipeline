// blockFetcher.ts
import { JsonRpcProvider, Block } from 'ethers';
import { IngestedTx } from './types';
import { includedSeenTotal, ingestToQueueMs } from './metrics';

export class BlockFetcher {
  private http: JsonRpcProvider;
  constructor(httpUrl: string) { this.http = new JsonRpcProvider(httpUrl); }

  async fetchBlockByNumberAndMap(num: number, seenAtMs: number): Promise<IngestedTx[]> {
    const block = await this.http.getBlock(num, true) as Block & { transactions: any[] };
    const includedAtMs = Date.now();

    const batch: IngestedTx[] = block.transactions.map((tx: any) => {
      const isHashOnly = typeof tx === 'string';
      const hash = isHashOnly ? tx : tx.hash;
      const from = isHashOnly ? null : (tx.from ?? null);
      const to = isHashOnly ? null : (tx.to ?? null);
      const valueWei = isHashOnly ? '0' : (tx.value?.toString?.() ?? String(tx.value ?? '0'));
      const feeWei = isHashOnly ? null : (tx.maxFeePerGas ? String(tx.maxFeePerGas) : null);
      return {
        status: 'included',
        hash,
        firstSeenMs: seenAtMs,
        includedBlock: Number(block.number),
        includedAtMs,
        from,
        to,
        valueWei,
        feeWei,
      } as IngestedTx;
    });
    includedSeenTotal.inc(batch.length);
    ingestToQueueMs.observe(includedAtMs - seenAtMs);
    return batch;
  }
}
