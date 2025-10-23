"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import TxList from '@/components/TxList';
import AddressFeed from '@/components/AddressFeed';
import { ListResp, Tx, fetchRecent, wsUrl, ioBaseUrl } from '@/lib/api';
import { connectWs } from '@/lib/ws';
import { WsBadge } from '@/components/WsBadge';

export default function Page() {
  const [pending, setPending] = useState<Tx[]>([]);
  const [processed, setProcessed] = useState<Tx[]>([]);
  const [connected, setConnected] = useState(false);
  const processedHashesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    processedHashesRef.current = new Set(processed.map((t) => String(t.hash).toLowerCase()));
  }, [processed]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let isMounted = true;
    (async () => {
      try {
        const r: ListResp = await fetchRecent(100);
        if (isMounted) {
          const p = r.items.filter((i) => i.status === 'pending');
          const inc = r.items.filter((i) => i.status === 'included');
          setPending(p);
          setProcessed(inc);
        }
      } catch {}

      // Wait for full page load to avoid the browser interrupting sockets during navigation
      if (document.readyState !== 'complete') {
        await new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
      }
      if (!isMounted) return;

      stop = connectWs({
        url: (process.env.NEXT_PUBLIC_USE_SIO ? (ioBaseUrl() + '/socket.io') : wsUrl('/stream/tx')),
        onMessage: (msg) => {
          if (!msg?.type || !msg?.tx || !msg.tx.hash) return;
          const hash = String(msg.tx.hash).toLowerCase();
          if (msg.type === 'pending') {
            setPending((prev) => {
              const dedup = prev.filter((p) => String(p.hash).toLowerCase() !== hash);
              const next = [{ ...(msg.tx as Tx), hash } as Tx, ...dedup].slice(0, 100);
              return next;
            });
            // If we already processed this hash, display the late pending briefly
            if (processedHashesRef.current.has(hash)) {
              setTimeout(() => {
                setPending((prev2) => prev2.filter((p) => String(p.hash).toLowerCase() !== hash));
              }, 1500);
            }
          } else if (msg.type === 'included') {
            const tx: Tx = { ...(msg.tx as Tx), hash };
            setPending((prev) => prev.filter((p) => String(p.hash).toLowerCase() !== hash));
            setProcessed((prev) => {
              const filtered = prev.filter((p) => String(p.hash).toLowerCase() !== hash);
              return [tx, ...filtered].slice(0, 200);
            });
          }
        },
        onStatus: setConnected,
      });
      // Make sure we close cleanly on navigation/unload so the server logs show 1001
    })();
    return () => {
      isMounted = false;
      try { stop?.(); } catch {}
    };
  }, []);

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold"> Watch transactions in real time.</h1>
          <WsBadge connected={connected} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TxList title="Pending" items={pending} empty="No pending transactions" />
          <TxList title="Processed" items={processed} empty="No processed transactions" />
          <AddressFeed />
        </div>
      </main>
    </div>
  );
}


