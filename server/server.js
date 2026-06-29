import express from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3001;
const TARGET = "https://smart-trip-planner-api.onrender.com";

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

app.listen(PORT, () => {
  console.log(`STP Proxy running on http://localhost:${PORT}`);
});
