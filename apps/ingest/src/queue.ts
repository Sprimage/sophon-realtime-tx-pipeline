import Redis from 'ioredis';
import { IngestedTx } from './types';
import { CFG } from './config';

const redis = new Redis(CFG.redisUrl);
const STREAM = CFG.stream;

let seenPending = 0;
let seenIncluded = 0;

export async function publish(batch: IngestedTx[]): Promise<void> {
  for (const e of batch) {
    if (e.status === 'pending') seenPending++;
    if (e.status === 'included') seenIncluded++;
  }
  const pipeline = redis.pipeline();
  for (const e of batch) {
    pipeline.xadd(STREAM, '*', 'data', JSON.stringify(e));
  }
  await pipeline.exec();
}

export function getStats() {
  return { seenPending, seenIncluded };
}
