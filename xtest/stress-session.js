#!/usr/bin/env node
/**
 * stress-session.js
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 API_PATH=/api/session COOKIE="tenant_session=..." node stress-session.js
 *
 * Environment/configurable via env vars:
 *   BASE_URL  - target base (default http://localhost:3000)
 *   API_PATH  - path to hit (default /api/session)
 *   CONCURRENCY - number of parallel requests per batch (default 5)
 *   DELAY_MS  - ms delay between batches (default 200)
 *   MAX_REQS  - maximum total requests before stopping (default 1000)
 *   MAX_ERRORS - maximum errors before stopping (default 50)
 *
 * Script prints a small report and exits when it receives the first 429, hits MAX_REQS, or hits MAX_ERRORS.
 */

/*
SAMPLE EXECUTION AND RESULT IN THE TERMINAL
>set COOKIE="tenant_session=eyJhbGciOiJIUzI1NiIsI..." && node xtest/stress-session.js

Stress test starting -> http://localhost:3000/api/session
Concurrency=5 delay=200ms maxReqs=1000 maxErrors=50
[ERR 5] status=401 body={"error":"No active session"}
[ERR 5] status=401 body={"error":"No active session"}
[ERR 5] status=401 body={"error":"No active session"}
[ERR 5] status=401 body={"error":"No active session"}
[ERR 5] status=401 body={"error":"No active session"}
[ERR 10] status=401 body={"error":"No active session"}
[ERR 10] status=401 body={"error":"No active session"}
[ERR 10] status=401 body={"error":"No active session"}
[ERR 10] status=401 body={"error":"No active session"}
[ERR 10] status=401 body={"error":"No active session"}
[THROTTLE 15] 429 - {"error":"Too Many Requests"}
[THROTTLE 15] 429 - {"error":"Too Many Requests"}
[THROTTLE 15] 429 - {"error":"Too Many Requests"}
[THROTTLE 15] 429 - {"error":"Too Many Requests"}
[THROTTLE 15] 429 - {"error":"Too Many Requests"}
------ SUMMARY ------
Attempts: 15
Successes: 0
Throttles (429): 5
Errors: 10
Stopped early due to throttle / policy.

*/

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_PATH = process.env.API_PATH || "/api/session";
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const DELAY_MS = Number(process.env.DELAY_MS || 200);
const MAX_REQS = Number(process.env.MAX_REQS || 1000);
const MAX_ERRORS = Number(process.env.MAX_ERRORS || 50);
const COOKIE = process.env.COOKIE || ""; // e.g. "tenant_session=eyJ...;"

const payload = {
  model: "gpt-realtime",
  voice: "alloy",
  instructions: "Test session spawn",
  // tools: []   // put a minimal valid tools array if the route validates it
};

let attempts = 0;
let successes = 0;
let throttles = 0;
let errors = 0;
let stopped = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function doOne(id) {
  attempts++;  // Increment early to avoid infinite loops on failures
  try {
    const res = await fetch(BASE_URL + API_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(COOKIE ? { "cookie": COOKIE } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 201 || res.status === 200) {
      successes++;
      const json = await res.json().catch(() => null);
      console.log(`[OK ${attempts}] status=${res.status} sm_session_id=${json?.sm_session_id ?? "n/a"}`);
      return { ok: true, status: res.status, body: json };
    }

    if (res.status === 429) {
      throttles++;
      const j = await res.json().catch(() => null);
      console.warn(`[THROTTLE ${attempts}] 429 - ${JSON.stringify(j)}`);
      stopped = true;
      return { ok: false, status: 429, body: j };
    }

    // other non-2xx
    errors++;
    const j = await res.text().catch(() => null);
    console.error(`[ERR ${attempts}] status=${res.status} body=${j}`);
    return { ok: false, status: res.status, body: j };

  } catch (e) {
    errors++;
    console.error(`[EXC ${attempts}]`, e?.message || e);
    return { ok: false, status: 0, body: String(e) };
  }
}

async function runBatch(batchId) {
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(doOne(i));
  }
  await Promise.all(workers);
}

(async function main() {
  console.log(`Stress test starting -> ${BASE_URL}${API_PATH}`);
  console.log(`Concurrency=${CONCURRENCY} delay=${DELAY_MS}ms maxReqs=${MAX_REQS} maxErrors=${MAX_ERRORS}`);
  while (!stopped && attempts < MAX_REQS && errors < MAX_ERRORS) {
    await runBatch();
    if (stopped || attempts >= MAX_REQS || errors >= MAX_ERRORS) break;
    await sleep(DELAY_MS);
  }

  console.log("------ SUMMARY ------");
  console.log(`Attempts: ${attempts}`);
  console.log(`Successes: ${successes}`);
  console.log(`Throttles (429): ${throttles}`);
  console.log(`Errors: ${errors}`);
  if (stopped) console.log("Stopped early due to throttle / policy.");
  if (errors >= MAX_ERRORS) console.log("Stopped early due to excessive errors.");
  process.exit(0);
})();