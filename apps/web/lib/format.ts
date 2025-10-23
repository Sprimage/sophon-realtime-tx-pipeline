export function shortHash(h: string, head = 8): string {
  if (!h) return '';
  if (h.length <= head * 2 + 3) return h;
  return `${h.slice(0, head)}…${h.slice(-head)}`;
}

export function fromNow(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}


