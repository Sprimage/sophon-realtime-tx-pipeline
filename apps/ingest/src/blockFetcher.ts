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

    const batch: IngestedTx[] = block.transactions.map((tx: any) => ({
      status: 'included',
      hash: tx.hash,
      firstSeenMs: seenAtMs,
      includedBlock: Number(block.number),
      includedAtMs,
      from: tx.from,
      to: tx.to ?? null,
      valueWei: tx.value?.toString?.() ?? String(tx.value ?? '0'),
      feeWei: tx.maxFeePerGas ? String(tx.maxFeePerGas) : null,
    }));
    includedSeenTotal.inc(batch.length);
    ingestToQueueMs.observe(includedAtMs - seenAtMs);
    return batch;
  }
}
