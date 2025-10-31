// middleware.ts
import { NextResponse, NextRequest } from "next/server";
import { ipFromHeaders, emailFromJwtCookie, sha256Hex } from "@/app/api/_lib/ids";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { rateCfg } from "@/config/rate";

/** Only guard the expensive realtime entry point */
export const config = {
  matcher: ["/api/session"],
};

// Upstash clients (Edge-safe). If absent, we use a tiny in-memory fallback (dev-only).
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Separate limiters so IP and USER can have **different** budgets.
const rlIp = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(Number(rateCfg.ipPerMin || 60), "1 m"),
      analytics: false,
      prefix: "rl:ip",
    })
  : null;

const rlUser = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(Number(rateCfg.userPerMin || 120), "1 m"),
      analytics: false,
      prefix: "rl:user",
    })
  : null;

export async function middleware(req: NextRequest) {
  // Allow static and preflight (good hygiene)
  if (req.method === "OPTIONS") return NextResponse.next();

  const ip = ipFromHeaders(req);
  const email = emailFromJwtCookie(req); // sync helper
  const userKey = email ? `u:${sha256Hex(email)}` : null;

  // ---- IP limit (edge drop) ----
  const ipRes = await limitKey(rlIp, `i:${ip}`, Number(rateCfg.ipPerMin || 60));
  if (!ipRes.ok) {
    return tooMany(429, ipRes.retryAfter, ipRes.limit, 0 /* remaining */, {
      clearSession: false, // IP hits shouldn't sign the user out
    });
  }

  // ---- USER limit (edge drop) ----
  if (userKey) {
    const uRes = await limitKey(rlUser, userKey, Number(rateCfg.userPerMin || 120));
    if (!uRes.ok) {
      return tooMany(429, uRes.retryAfter, uRes.limit, 0, {
        clearSession: true, // user exceeded = log them out to stop retries
      });
    }
  }

  // Pass through
  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Policy", "edge:ip+user @ /api/session");
  return res;
}

/** Shared limiter with dev fallback (fixed 60s window). */
async function limitKey(
  rl: Ratelimit | null,
  key: string,
  limit: number
): Promise<{ ok: boolean; retryAfter: number; limit: number }> {
  if (rl) {
    const r = await rl.limit(key);
    const retryAfterSec = Math.max(0, Math.ceil((r.reset - Date.now()) / 1000));
    return { ok: r.success, retryAfter: retryAfterSec, limit };
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
    return { ok: true, retryAfter: 60, limit };
  }
  rec.count++;
  const ok = rec.count <= limit;
  const retryAfter = Math.ceil((rec.exp - now) / 1000);
  return { ok, retryAfter, limit };
}

function tooMany(
  status: number,
  retryAfterSec: number,
  limit: number,
  remaining: number,
  opts?: { clearSession?: boolean }
) {
  const res = NextResponse.json(
    { error: "Too Many Requests", limit, remaining, retryAfter: retryAfterSec },
    { status }
  );
  res.headers.set("Retry-After", String(retryAfterSec));
  res.headers.set("X-RateLimit-Limit", String(limit));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  if (opts?.clearSession) {
    res.cookies.set("tenant_session", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
