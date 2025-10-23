import Redis from 'ioredis';
import pino from 'pino';
import { CFG } from './config';

const log = pino({ name: 'indexer:redis' });

export function createRedisClient() {
  return new Redis(CFG.redisUrl);
}

export async function ensureGroup(redis: ReturnType<typeof createRedisClient>): Promise<void> {
  try {
    await redis.xgroup('CREATE', CFG.stream, CFG.group, '0', 'MKSTREAM');
    log.info({ stream: CFG.stream, group: CFG.group }, 'created consumer group');
  } catch (e: any) {
    if (String(e?.message ?? '').includes('BUSYGROUP')) return;
    throw e;
  }
}

export async function readAndAckLoop(redis: ReturnType<typeof createRedisClient>, onBatch: (events: any[]) => Promise<void>) {
  for (;;) {
    try {
      const resp = await redis.xreadgroup(
        'GROUP', CFG.group, CFG.consumer,
        'COUNT', CFG.batchSize,
        'BLOCK', 5000,
        'STREAMS', CFG.stream, '>'
      ) as null | [string, [string, string[]][]][];
      if (!resp) continue;
      const [, entries] = resp[0];
      const parsed: { id: string; evt: any }[] = (entries as [string, string[]][]) .map(([id, fields]) => {
        const idx = fields.findIndex((k) => k === 'data');
        const json = idx >= 0 ? fields[idx + 1] : '{}';
        return { id, evt: JSON.parse(json) };
      });
      await onBatch(parsed.map((p) => p.evt));
      const pipeline = redis.pipeline();
      for (const p of parsed) pipeline.xack(CFG.stream, CFG.group, p.id);
      await pipeline.exec();
    } catch (err) {
      log.error({ err }, 'consumer error, continuing');
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

