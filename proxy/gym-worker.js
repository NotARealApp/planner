// Cloudflare Worker: CORS proxy for McFit / RSG-Group studio occupancy.
//
// The app is a static site (GitHub Pages), and McFit's occupancy API both
// requires an `x-tenant` header and sends no CORS headers — so a browser can't
// call it directly. This Worker adds the header, adds CORS, and forwards.
//
// Deploy:  cd proxy && npx wrangler deploy
// Then set NEXT_PUBLIC_GYM_PROXY to the deployed URL (see proxy/README.md).
//
// Usage:   GET https://<your-worker>.workers.dev/<studioId>

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    // Path is just the numeric studio id — strip anything else defensively.
    const id = new URL(req.url).pathname.replace(/\D/g, "");
    if (!id) return new Response("missing studio id", { status: 400, headers: CORS });

    const upstream = await fetch(
      `https://my.mcfit.com/nox/public/v1/studios/${id}/utilization/v2/today`,
      { headers: { "x-tenant": "rsg-group" } },
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS,
        "content-type": "application/json",
        // Occupancy moves in 1-hour buckets — a 5-min edge cache is plenty and
        // keeps you well under the free tier's request limit.
        "cache-control": "public, max-age=300",
      },
    });
  },
};
