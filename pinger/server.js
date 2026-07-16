import express from "express";

const app = express();
const PORT = process.env.PORT || 3002;
const STP_SERVER_URL = process.env.STP_SERVER_URL
  ? `https://${process.env.STP_SERVER_URL}`
  : null;
const EXTERNAL_API = "https://smart-trip-planner-api.onrender.com";
const INTERVAL_MS = 10 * 60 * 1000;

app.get("/health", (_req, res) => res.send("OK"));

function log(url, status) {
  console.log(`[PINGER] ${url} → ${status}`);
}

async function ping(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    log(url, res.status);
  } catch (err) {
    log(url, `ERR ${err.message}`);
  }
}

async function tick() {
  console.log(`[PINGER] tick at ${new Date().toISOString()}`);

  await ping(`${EXTERNAL_API}/api/cities/madrid/interests`);

  if (STP_SERVER_URL) {
    await ping(`${STP_SERVER_URL}/health`);
  }
}

tick();
setInterval(tick, INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Pinger running on http://localhost:${PORT}`);
  if (STP_SERVER_URL) console.log(`  → pinging ${STP_SERVER_URL}/health`);
  console.log(`  → pinging ${EXTERNAL_API}/api/cities/madrid/interests`);
});
