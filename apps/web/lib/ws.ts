export type WsOpts = {
  url: string;
  onMessage: (data: any) => void;
  onStatus?: (connected: boolean) => void;
};

// Socket.IO client singleton
let ioSocket: any;

export function connectWs({ url, onMessage, onStatus }: WsOpts) {
  // Prefer Socket.IO when URL includes "/socket.io" (dev) or when global io is desired
  if (url.includes('/socket.io')) {
    try {
      if (!ioSocket) {
        // Lazy import to keep bundle lean if not used
        const { io } = require('socket.io-client');
        ioSocket = io(url, { transports: ['websocket'], path: '/socket.io' });
      }
      ioSocket.on('connect', () => onStatus?.(true));
      ioSocket.on('disconnect', () => onStatus?.(false));
      ioSocket.on('tx_global', (msg: any) => onMessage(msg));
      return () => {
        try { ioSocket.off('tx_global'); } catch {}
      };
    } catch {
      // fall back to raw WS below
    }
  }
  let socket: WebSocket | undefined;
  let stopped = false;
  let backoffMs = 1000; // start at 1s to avoid rapid loops during dev reloads
  let lastConnectTs = 0;
  let openedAt = 0;
  let unloadHandler: (() => void) | undefined;
  let deferredOnce = false;

  const open = () => {
    if (stopped) return;
    // Defer the very first connection until after full page load to avoid
    // browsers interrupting sockets during navigation/bootstrap (dev noise)
    if (!deferredOnce && typeof document !== 'undefined' && document.readyState !== 'complete') {
      deferredOnce = true;
      try {
        window.addEventListener('load', () => setTimeout(open, 150), { once: true });
      } catch {
        setTimeout(open, 200);
      }
      return;
    }
    // Avoid creating a new socket while the previous one is still CONNECTING
    if (socket && socket.readyState === WebSocket.CONNECTING) return;
    const now = Date.now();
    if (now - lastConnectTs < 800) return; // throttle rapid re-opens
    lastConnectTs = now;
    socket = new WebSocket(url);
    openedAt = Date.now();
    socket.onopen = () => {
      backoffMs = 1000;
      onStatus?.(true);
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('[ws] open', url); } catch {}
      }
    };
    // Do not force-close on error; wait for onclose so we don't loop aggressively
    socket.onerror = () => { onStatus?.(false); };
    socket.onclose = (ev) => {
      onStatus?.(false);
      if (process.env.NODE_ENV !== 'production') {
        try { console.debug('[ws] close', url, { code: ev.code, reason: ev.reason, ms: Date.now() - openedAt }); } catch {}
      }
      if (stopped) return;
      const wait = backoffMs;
      backoffMs = Math.min(backoffMs * 2, 5000);
      setTimeout(open, wait);
    };
    socket.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data as string);
        if (!parsed || typeof parsed !== 'object') return;
        onMessage(parsed);
      } catch {}
    };
  };

  open();

  return () => {
    stopped = true;
    if (unloadHandler) {
      try { window.removeEventListener('beforeunload', unloadHandler); } catch {}
      unloadHandler = undefined;
    }
    try { socket?.close(1001, 'page unloading'); } catch {}
  };
}


