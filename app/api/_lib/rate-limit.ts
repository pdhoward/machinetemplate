// /app/api/_lib/rate-limit.ts
import getMongoConnection from "@/db/connections";
import { getActiveOtpSession } from "@/app/api/_lib/session";
import { NextRequest, NextResponse } from "next/server";
import { ipFromHeaders, sha256Hex } from "./ids";
import type { Db, Collection } from "mongodb";
import { rateCfg } from "@/config/rate";

/**
 * Server-side quota enforcement:
 * - Optional per-minute counters (IP/USER/SESSION) using Mongo fixed windows.
 * - Mandatory per-session per-minute counter and daily quota checks (tokens/$).
 * - Use TTL indexes so these counters expire automatically.
 *
 * NOTE: To avoid double-counting with the edge middleware, leave
 *   rateCfg.enableServerMinuteChecks === false for /api/session.
 */

type QuotaConfig = {
  ipPerMin?: number;
  userPerMin?: number;
  sessionPerMin?: number;
  maxDailyTokens?: number;
  maxDailyDollars?: number;
  windowSec?: number;
};

const DEFAULTS: Required<QuotaConfig> = {
  ipPerMin: rateCfg.ipPerMin,
  userPerMin: rateCfg.userPerMin,
  sessionPerMin: rateCfg.sessionPerMin,
  maxDailyTokens: rateCfg.maxDailyTokens,
  maxDailyDollars: rateCfg.maxDailyDollars,
  windowSec: rateCfg.windowSec,
};

type RateDoc = {
  _id: string;      // e.g. "ip:127.0.0.1:29367014" (29367014 = floor(epochSec / windowSec))
  count: number;
  windowSec: number;
  createdAt: Date;
};

export async function withRateLimit(
  req: NextRequest,
  handler: () => Promise<NextResponse>,
  cfg: QuotaConfig = {}
): Promise<NextResponse> {
  const C = { ...DEFAULTS, ...cfg };
  const ip = ipFromHeaders(req);
  const session = await getActiveOtpSession(req as unknown as Request);
  const email = session?.email ?? null;

  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  const rateColl = db.collection<RateDoc>("ratelimits");

  // Compute fixed-window keys
  const winId = Math.floor(Date.now() / 1000 / C.windowSec);
  const ipKey   = `ip:${ip}:${winId}`;
  const userKey = email ? `user:${sha256Hex(email)}:${winId}` : null;
  const sessKey = session?.sessionTokenHash ? `sess:${session.sessionTokenHash}:${winId}` : null;

  // --- Per-minute counters (opt-in for IP/USER) ---
  const doServerMinuteChecks = rateCfg.enableServerMinuteChecks; // keep simple and global

  const bulk = rateColl.initializeUnorderedBulkOp();
  // Always track per-session minute usage (needed for sessionPerMin)
  if (sessKey) bulk.find({ _id: sessKey }).upsert().updateOne({ $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { windowSec: C.windowSec } });
  if (doServerMinuteChecks) {
    bulk.find({ _id: ipKey  }).upsert().updateOne({ $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { windowSec: C.windowSec } });
    if (userKey) bulk.find({ _id: userKey }).upsert().updateOne({ $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { windowSec: C.windowSec } });
  }
  if (bulk.length) await bulk.execute();

  const keys = [sessKey, doServerMinuteChecks ? ipKey : null, doServerMinuteChecks ? userKey : null].filter(Boolean) as string[];
  const docs = keys.length ? await rateColl.find({ _id: { $in: keys } }).toArray() : [];

  const sessCount = sessKey ? (docs.find(d => d._id === sessKey)?.count ?? 0) : 0;
  const ipCount   = doServerMinuteChecks ? (docs.find(d => d._id === ipKey)?.count ?? 0) : 0;
  const userCount = doServerMinuteChecks && userKey ? (docs.find(d => d._id === userKey)?.count ?? 0) : 0;

  // Enforce session/minute (always) and IP/USER (optional)
  const overIp   = doServerMinuteChecks && ipCount   > C.ipPerMin;
  const overUser = doServerMinuteChecks && userKey && userCount > C.userPerMin;
  const overSess = sessKey && sessCount > C.sessionPerMin;

  if (overIp || overUser || overSess) {
    const res = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    if (session) {
      res.cookies.set("tenant_session", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    }
    return res;
  }

  // --- Daily quotas (Mongo-backed; independent of session) ---
  if (email) {
    const usageLimit = await enforceDailyQuota(db, email, {
      maxDailyTokens: C.maxDailyTokens,
      maxDailyDollars: C.maxDailyDollars,
    });
    if (!usageLimit.ok) {
      const res = NextResponse.json(
        { error: "Quota exceeded", tokens: usageLimit.tokens, dollars: usageLimit.dollars, limits: usageLimit.limits },
        { status: 429 }
      );
      res.cookies.set("tenant_session", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
      return res;
    }
  }

  return handler();
}

// Daily quotas (kept small by TTL on old days via partition key strategy if desired)

type DailyUsage = {
  _id: string;        // "d:<sha256(email)>:<YYYY-MM-DD>"
  emailHash: string;
  date: string;       // ISO day
  tokens: number;
  dollars: number;
  updatedAt: Date;
  createdAt: Date;
};

async function enforceDailyQuota(
  db: Db,
  email: string,
  limits: { maxDailyTokens: number; maxDailyDollars: number; }
): Promise<{ ok: boolean; tokens: number; dollars: number; limits: typeof limits }> {
  const coll: Collection<DailyUsage> = db.collection<DailyUsage>("usage_daily");
  const today = new Date().toISOString().slice(0, 10);
  const emailHash = sha256Hex(email);
  const id = `d:${emailHash}:${today}`;

  await coll.updateOne(
    { _id: id },
    { $setOnInsert: { _id: id, emailHash, date: today, tokens: 0, dollars: 0, createdAt: new Date() }, $set: { updatedAt: new Date() } },
    { upsert: true }
  );

  const doc = await coll.findOne({ _id: id });
  const tokens = doc?.tokens ?? 0;
  const dollars = doc?.dollars ?? 0;

  const ok = tokens <= limits.maxDailyTokens && dollars <= limits.maxDailyDollars;
  return { ok, tokens, dollars, limits };
}
