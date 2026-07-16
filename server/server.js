import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3001;
const TARGET = "https://smart-trip-planner-api.onrender.com";
const PINGER_URL = process.env.PINGER_URL
  ? `https://${process.env.PINGER_URL}/health`
  : null;
const INTERVAL_MS = 10 * 60 * 1000;

app.use(cors({ origin: true, credentials: true }));

app.get("/health", (_req, res) => res.send("OK"));

app.use(
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    pathFilter: "/api",
    pathRewrite: {
      "^/api/trips/places/search": "/trips/places/search",
    },
    on: {
      proxyReq: (proxyReq, req) => {
        const auth = req.headers["authorization"];
        if (auth) proxyReq.setHeader("Authorization", auth);
        proxyReq.setHeader("Accept", "text/plain");
      },
    },
  })
);

async function pingPinger() {
  if (!PINGER_URL) return;
  try {
    const res = await fetch(PINGER_URL, { signal: AbortSignal.timeout(10000) });
    console.log(`[PING] pinger → ${res.status}`);
  } catch (err) {
    console.log(`[PING] pinger ERR ${err.message}`);
  }
}

if (PINGER_URL) {
  pingPinger();
  setInterval(pingPinger, INTERVAL_MS);
}

app.listen(PORT, () => {
  console.log(`STP Proxy running on http://localhost:${PORT}`);
  if (PINGER_URL) console.log(`  → pinging ${PINGER_URL}`);
});
