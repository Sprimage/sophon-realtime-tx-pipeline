import { Tx } from '@/lib/api';
import { fromNow, shortHash } from '@/lib/format';

type Props = {
  title: string;
  items: Tx[];
  empty: string;
};

export default function TxList({ title, items, empty }: Props) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs muted">{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-sm muted">{empty}</li>
        )}
        {items.filter(Boolean).map((tx, idx) => {
          const keyBase = tx.hash ?? String(tx.firstSeenMs ?? 'no-ts');
          return (
          <li key={`${keyBase}-${idx}`} className="animate-fadeInUp">
            <a href={`https://explorer.sophon.xyz/tx/${tx.hash}`} target="_blank" className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50">
              <div className="truncate">
                <div className="text-sm font-medium">{shortHash(tx.hash)}</div>
                <div className="text-xs muted">{fromNow(tx.firstSeenMs)}</div>
              </div>
              {tx.includedBlock ? (
                <span className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">included #{tx.includedBlock}</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200">pending</span>
              )}
            </a>
          </li>
          );
        })}
      </ul>
    </section>
  );
}


