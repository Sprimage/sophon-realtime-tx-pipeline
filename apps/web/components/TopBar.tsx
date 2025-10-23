export default function TopBar() {
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-brand" />
          <span className="font-semibold text-lg">Sophon Streamer</span>
        </div>
        <div className="text-sm muted">Realtime Transaction Dashboard</div>
      </div>
    </header>
  );
}


