"use client";
import { useEffect, useMemo, useState } from 'react';
import { ListResp, Tx, fetchAddress, wsUrl, ioBaseUrl } from '@/lib/api';
import { connectWs } from '@/lib/ws';
import TxList from './TxList';
import { WsBadge } from './WsBadge';

export default function AddressFeed() {
  const [addr, setAddr] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState<Tx[]>([]);

  const normalized = useMemo(() => addr.trim().toLowerCase(), [addr]);

  useEffect(() => {
    if (!normalized) return;
    let stop: (() => void) | undefined;
    let closed = false;
    (async () => {
      try {
        const initial: ListResp = await fetchAddress(normalized, 50);
        setItems(initial.items);
      } catch {}
      stop = connectWs({
        url: (process.env.NEXT_PUBLIC_USE_SIO ? (ioBaseUrl() + '/socket.io') : wsUrl(`/stream/address?addr=${encodeURIComponent(normalized)}`)),
        onMessage: (msg) => {
          if (!msg?.type || !msg?.tx || !msg.tx.hash) return;
          const hash = String(msg.tx.hash).toLowerCase();
          setItems((prev) => {
            const seen = new Set(prev.map((p) => String(p.hash).toLowerCase()));
            if (msg.type === 'pending') {
              if (seen.has(hash)) return prev;
              const next = [{ ...(msg.tx as Tx), hash }, ...prev];
              return next.slice(0, 100);
            }
            if (msg.type === 'included') {
              const tx: Tx = { ...(msg.tx as Tx), hash };
              const withUpdated = prev.map((p) => (String(p.hash).toLowerCase() === hash ? tx : p));
              if (!seen.has(hash)) return [tx, ...withUpdated].slice(0, 100);
              return withUpdated;
            }
            return prev;
          });
        },
        onStatus: setConnected,
      });
    })();
    return () => {
      closed = true;
      try { stop?.(); } catch {}
    };
  }, [normalized]);

  return (
    <section className="card p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Address live feed</h2>
        <WsBadge connected={connected} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input
          placeholder="0x… address"
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/40"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
        />
      </div>
      <TxList title="Transactions" items={items} empty={normalized ? 'Waiting for events…' : 'Enter an address to subscribe'} />
      <p className="muted text-xs mt-2">Entries update in-place from pending → included and keep ordering by latest event time.</p>
    </section>
  );
}


