import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3001;
const TARGET = "https://smart-trip-planner-api.onrender.com";

// ── Hardcoded pinger URL (actualizar según deploy) ──
const PINGER = process.env.PINGER_URL || "https://stp-pinger.onrender.com";
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
  try {
    const res = await fetch(`${PINGER}/health`, { signal: AbortSignal.timeout(10000) });
    console.log(`[PING] pinger → ${res.status}`);
  } catch (err) {
    console.log(`[PING] pinger ERR ${err.message}`);
  }
}

pingPinger();
setInterval(pingPinger, INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`STP Proxy running on http://localhost:${PORT}`);
  console.log(`  → pinging ${PINGER}/health`);
});
