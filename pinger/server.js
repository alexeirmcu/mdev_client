import express from "express";

const app = express();
const PORT = process.env.PORT || 3002;

// ── Hardcoded URLs (actualizar según deploy) ──
let STP_SERVER = process.env.STP_SERVER || "https://stp-server-hdlq.onrender.com";
if (STP_SERVER && !STP_SERVER.startsWith("http")) STP_SERVER = `https://${STP_SERVER}`;
const EXTERNAL_API = "https://smart-trip-planner-api.onrender.com";
const INTERVAL_MS = 10 * 60 * 1000;

app.get("/health", (_req, res) => res.send("OK"));

async function ping(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    console.log(`[PINGER] ${url} → ${res.status}`);
  } catch (err) {
    console.log(`[PINGER] ${url} → ERR ${err.message}`);
  }
}

async function tick() {
  console.log(`[PINGER] tick at ${new Date().toISOString()}`);
  await ping(`${EXTERNAL_API}/api/cities/madrid/interests`);
  await ping(`${STP_SERVER}/health`);
}

tick();
setInterval(tick, INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Pinger running on http://localhost:${PORT}`);
  console.log(`  → pinging ${EXTERNAL_API}/api/cities/madrid/interests`);
  console.log(`  → pinging ${STP_SERVER}/health`);
});
