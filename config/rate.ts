// /config/rate.ts
// Single source of truth for platform limits. 
// Values come from env with safe defaults.


function num(v: string | undefined, dflt: number) {
const n = Number(v);
return Number.isFinite(n) && n >= 0 ? n : dflt;
}

export const rateCfg = {
// Minute windows (edge per-minute controls)
ipPerMin: num(process.env.RATE_IP_PER_MIN, 60), // requests/min per IP
userPerMin: num(process.env.RATE_USER_PER_MIN, 120), // requests/min per authenticated user (edge)
sessionPerMin: num(process.env.RATE_SESSION_PER_MIN, 6), // requests/min per active session (server)

// Optional burst for token bucket style edge limiters
burst: num(process.env.RATE_BURST, 20),

// Daily user quotas (server-side, Mongo-backed)
maxDailyTokens: num(process.env.USER_MAX_TOKENS_DAILY, 150000),
maxDailyDollars: num(process.env.USER_MAX_DOLLARS_DAILY, 5),

// Realtime session bounds (server-side)
maxConcurrentPerUser: num(process.env.MAX_CONCURRENT_SESSIONS_PER_USER, 2),
maxSessionMinutes: num(process.env.MAX_SESSION_MINUTES, 15),
maxSessionIdleSec: num(process.env.MAX_SESSION_IDLE_SEC, 300),

// Fixed window size used by Mongo minute counters (seconds)
windowSec: 60,

// Policy toggles
requireAuthForSession: String(process.env.REQUIRE_AUTH_FOR_SESSION || 'true') === 'true',
// Enforce per‑IP/per‑user per‑minute via the API layer (ie Mongo) in addition to the edge by setting to true
enableServerMinuteChecks: String(process.env.ENABLE_SERVER_MINUTE_CHECKS || 'false') === 'true',
} as const;