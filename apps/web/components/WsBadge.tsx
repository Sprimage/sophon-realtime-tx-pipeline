export function WsBadge({ connected }: { connected: boolean }) {
  return (
    <div className={
      `inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ` +
      (connected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')
    }>
      <span className={
        'h-2 w-2 rounded-full ' + (connected ? 'bg-green-500' : 'bg-red-500')
      } />
      {connected ? 'Live' : 'Disconnected'}
    </div>
  );
}


