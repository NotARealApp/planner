# Gym occupancy proxy

McFit / RSG-Group's live occupancy API needs an `x-tenant` header and sends no
CORS headers, so the static app can't call it from the browser. This tiny
Cloudflare Worker adds the header + CORS and forwards the request.

## Deploy (once)

```bash
cd proxy
npx wrangler login      # opens a browser, free Cloudflare account
npx wrangler deploy
```

Wrangler prints a URL like `https://gym-proxy.<you>.workers.dev`.

## Point the app at it

Set the env var the build reads (`NEXT_PUBLIC_GYM_PROXY`):

- **Local:** add to `.env.local` in the repo root:
  ```
  NEXT_PUBLIC_GYM_PROXY=https://gym-proxy.<you>.workers.dev
  ```
- **GitHub Pages deploy:** add a repository **variable** named `GYM_PROXY`
  (Settings → Secrets and variables → Actions → Variables) with the same URL.
  The deploy workflow passes it through.

No proxy configured → the gym occupancy panel simply stays hidden; everything
else works unchanged.

## Test

```bash
curl https://gym-proxy.<you>.workers.dev/1858374200
```

Returns 24 hourly buckets; the one with `"current": true` is now.
