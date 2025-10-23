# sophon-realtime-tx-pipeline

## Realtime Dashboard

This repo now includes a lightweight Next.js dashboard in `apps/web` styled like the Sophon Explorer.

### Dev

1. Start API (same-origin endpoint base):
   - `API_PORT=3000 SOPHON_HTTP=... pnpm --filter api dev`
2. Start web (separate port 3001, but calls API at 3000):
   - `pnpm --filter sophon-web dev`

Environment overrides for the web app:

```
NEXT_PUBLIC_API_BASE=http://localhost:3000
NEXT_PUBLIC_WS_BASE=ws://localhost:3000
```

### Serve dashboard from API

Build and export the web app, then let the API serve the static output:

```
pnpm --filter sophon-web build && pnpm --filter sophon-web export
SERVE_DASHBOARD=1 pnpm --filter api start
```

