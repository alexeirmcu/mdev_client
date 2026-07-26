import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3001;
const TARGET = "https://smart-trip-planner-api.onrender.com";

function corsMiddleware(req, res, next) {
  const origin = req.headers["origin"] || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

app.use(corsMiddleware);

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
      proxyRes: (proxyRes, req) => {
        const origin = req.headers["origin"] || "*";
        proxyRes.headers["Access-Control-Allow-Origin"] = origin;
        proxyRes.headers["Access-Control-Allow-Credentials"] = "true";
      },
      error: (err, _req, res) => {
        console.error("Proxy error:", err.message);
        if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Proxy error");
      },
    },
  })
);

app.listen(PORT, () => {
  console.log(`STP Proxy running on http://localhost:${PORT}`);
});
