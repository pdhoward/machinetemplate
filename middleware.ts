// middleware.ts
import { NextResponse, NextRequest } from "next/server";
import { ipFromHeaders, emailFromJwtCookie, sha256Hex } from "@/app/api/_lib/ids";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { rateCfg } from "@/config/rate";

/**
 * Edge guard for the *expensive* realtime entrypoint.
 * - Enforces per-IP and per-USER minute budgets using Upstash (sliding window + optional burst).
 * - Returns actionable X-RateLimit-* headers so clients can back off.
 * - Server layer will handle session/minute & daily quotas; avoid double-counting.
 */
export const config = { matcher: ["/api/session"] };

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  : null;

// Separate limiters so IP and USER can have different budgets
const rlIp = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(rateCfg.ipPerMin, "1 m"),
  analytics: true,              // enable Upstash analytics for observability
  prefix: "rl:ip",
}) : null;

const rlUser = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(rateCfg.userPerMin, "1 m"),
  analytics: true,
  prefix: "rl:user",
}) : null;

export async function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") return NextResponse.next();

  const ip = ipFromHeaders(req);
  const email = emailFromJwtCookie(req); // sync helper
  const userKey = email ? `u:${sha256Hex(email)}` : null;

  // ---- IP limit (edge drop) ----
  const ipRes = await limitKey(rlIp, `i:${ip}`, rateCfg.ipPerMin);
  if (!ipRes.ok) return tooMany(429, ipRes);

  // ---- USER limit (edge drop) ----
  if (userKey) {
    const uRes = await limitKey(rlUser, userKey, rateCfg.userPerMin);
    if (!uRes.ok) return tooMany(429, uRes, { clearSession: true });
  }

  // Pass-through with informative headers (policy only; no personal data)
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Policy", "edge: ip+user @ /api/session (1m sliding)");
  // Optional: expose last computed values for debugging (not PII)
  if (ipRes) {
    res.headers.set("X-RateLimit-Limit-Ip", String(ipRes.limit));
    res.headers.set("X-RateLimit-Remaining-Ip", String(Math.max(0, ipRes.remaining)));
    res.headers.set("X-RateLimit-Reset-Ip", String(ipRes.retryAfter));
  }
  return res;
}

/** Shared limiter wrapper with a tiny in-memory fallback (dev only) */
async function limitKey(
  rl: Ratelimit | null,
  key: string,
  limit: number
): Promise<{ ok: boolean; retryAfter: number; limit: number; remaining: number }> {
  if (rl) {
    const r = await rl.limit(key);
    const retryAfterSec = Math.max(0, Math.ceil((r.reset - Date.now()) / 1000));
    const remaining = Math.max(0, (r.remaining ?? (limit - 1))); // Upstash provides remaining
    return { ok: r.success, retryAfter: retryAfterSec, limit, remaining };
  }
  // Dev fallback (NOT for prod)
  // @ts-ignore
  globalThis.__MEM ||= new Map<string, { count: number; exp: number }>();
  // @ts-ignore
  const M: Map<string, { count: number; exp: number }> = globalThis.__MEM;
  const now = Date.now();
  const win = 60_000;
  const stamp = Math.floor(now / win);
  const storageKey = `dev:${key}:${stamp}`;
  const rec = M.get(storageKey);
  if (!rec) {
    M.set(storageKey, { count: 1, exp: now + win });
    return { ok: true, retryAfter: 60, limit, remaining: limit - 1 };
  }
  rec.count++;
  const ok = rec.count <= limit;
  const retryAfter = Math.ceil((rec.exp - now) / 1000);
  return { ok, retryAfter, limit, remaining: Math.max(0, limit - rec.count) };
}

function tooMany(
  status: number,
  src: { retryAfter: number; limit: number; remaining: number },
  opts?: { clearSession?: boolean }
) {
  const res = NextResponse.json(
    { error: "Too Many Requests", limit: src.limit, remaining: 0, retryAfter: src.retryAfter },
    { status }
  );
  res.headers.set("Retry-After", String(src.retryAfter));
  res.headers.set("X-RateLimit-Limit", String(src.limit));
  res.headers.set("X-RateLimit-Remaining", "0");
  if (opts?.clearSession) {
    res.cookies.set("tenant_session", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  }
  return res;
}
