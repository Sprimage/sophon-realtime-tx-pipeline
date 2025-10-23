import { IngestedTx } from './types';

type Listener = (batch: IngestedTx[]) => Promise<void> | void;

class InprocQueue {
  private listeners: Listener[] = [];
  on(fn: Listener) { this.listeners.push(fn); }
  async publish(batch: IngestedTx[]) {
    await Promise.all(this.listeners.map(l => l(batch)));
  }
}
export const queue = new InprocQueue();
