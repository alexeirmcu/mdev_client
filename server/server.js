import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3001;
const TARGET = "https://smart-trip-planner-api.onrender.com";

function setCors(origin, headers) {
  headers["Access-Control-Allow-Origin"] = origin || "*";
  headers["Access-Control-Allow-Credentials"] = "true";
  headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept";
  headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS";
}

app.use(cors({ origin: true, credentials: true }));
app.options("/api/*", cors({ origin: true, credentials: true }));

app.get("/health", (_req, res) => res.send("OK"));

// Handle OPTIONS preflight before proxy
app.options("*", (_req, res) => res.sendStatus(204));

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
        setCors(req.headers["origin"], proxyRes.headers);
      },
      error: (err, _req, res) => {
        console.error("Proxy error:", err.message);
        if (res.writeHead) { res.writeHead(502, { "Content-Type": "text/plain" }); res.end("Proxy error"); }
      },
    },
  })
);

app.listen(PORT, () => {
  console.log(`STP Proxy running on http://localhost:${PORT}`);
});
