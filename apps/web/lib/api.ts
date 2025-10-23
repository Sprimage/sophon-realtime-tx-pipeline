export type Tx = {
  hash: string;
  firstSeenMs: number;
  status: 'pending' | 'included' | 'dropped';
  includedBlock?: number | null;
  includedAtMs?: number | null;
  fromAddr?: string | null;
  toAddr?: string | null;
  valueWei?: string | null;
  feeWei?: string | null;
};

export type ListResp = { items: Tx[]; nextCursor?: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3200';

export async function fetchRecent(limit = 100): Promise<ListResp> {
  const r = await fetch(`${API_BASE}/tx?limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('fetch /tx failed');
  return r.json();
}

export async function fetchAddress(addr: string, limit = 50): Promise<ListResp> {
  const r = await fetch(`${API_BASE}/address/${addr}/tx?limit=${limit}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('fetch /address failed');
  return r.json();
}

export function wsUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:3200';
  return base + path;
}

export function ioBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3200';
}


