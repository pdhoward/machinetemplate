/**
 * testUsageReport.js
 *
 * Simple Node script to POST usage data to /api/usage/report
 * the same way your frontend will during a realtime session.
 *
 * Usage:
 *   1. Replace the COOKIE value below with a valid tenant_session cookie
 *   2. Run:  node testUsageReport.js
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ---- CONFIG ----
const ENDPOINT = "http://localhost:3000/api/usage/report";
//const COOKIE   = "tenant_session=REPLACE_ME_WITH_REAL_COOKIE";   // <--- UPDATE THIS
const COOKIE   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZW5hbnRfc2Vzc2lvbiIsImVtYWlsIjoicGF0cmljay5ob3dhcmRAaG90bWFpbC5jb20iLCJ0ZW5hbnRJZCI6ImN5cHJlc3MtcmVzb3J0cyIsImlhdCI6MTc2MjI3MTc0MiwiZXhwIjoxNzYyODc2NTQyfQ.WfdmxbUvONq23uSDq0rmw5F0lb5B9_AFbKCHNPMdbXM";   // <--- UPDATE THIS
const PAYLOAD  = {
  text_in: 1000,
  text_out: 2000,
  audio_in: 0,
  audio_out: 500,
};
// ----------------

async function main() {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": COOKIE,   // <-- sends the session cookie like curl --cookie
      },
      body: JSON.stringify(PAYLOAD),
    });

    const txt = await res.text();
    console.log(`Status: ${res.status}`);
    console.log("Response:\n", txt);
  } catch (err) {
    console.error("Request failed:", err);
  }
}

main();
