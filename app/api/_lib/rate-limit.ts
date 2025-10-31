// /app/api/_lib/rate-limit.ts
import getMongoConnection from "@/db/connections";
import { getActiveOtpSession } from "@/app/api/_lib/session";
import { NextRequest, NextResponse } from "next/server";
import { ipFromHeaders, sha256Hex } from "./ids";
import type { Db, Collection } from "mongodb";

type QuotaConfig = {
  ipPerMin?: number;
  userPerMin?: number;
  sessionPerMin?: number;     // NEW
  maxDailyTokens?: number;
  maxDailyDollars?: number;
  windowSec?: number;
};

const DEFAULTS: Required<QuotaConfig> = {
  ipPerMin: Number(process.env.RATE_IP_PER_MIN || 60),
  userPerMin: Number(process.env.RATE_USER_PER_MIN || 120),
  sessionPerMin: Number(process.env.RATE_SESSION_PER_MIN || 90),
  maxDailyTokens: Number(process.env.USER_MAX_TOKENS_DAILY || 150000),
  maxDailyDollars: Number(process.env.USER_MAX_DOLLARS_DAILY || 15),
  windowSec: 60,
};

type RateDoc = {
  _id: string;        // string keys (avoid ObjectId mismatch)
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

  // --- per-minute counters (fixed window) ---
  const winId = Math.floor(Date.now() / 1000 / C.windowSec);
  const ipKey   = `ip:${ip}:${winId}`;
  const userKey = email ? `user:${sha256Hex(email)}:${winId}` : null;
  const sessKey = session?.sessionTokenHash ? `sess:${session.sessionTokenHash}:${winId}` : null;

  const bulk = rateColl.initializeUnorderedBulkOp();
  bulk.find({ _id: ipKey  }).upsert().updateOne({ $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { windowSec: C.windowSec } });
  if (userKey) bulk.find({ _id: userKey }).upsert().updateOne({ $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { windowSec: C.windowSec } });
  if (sessKey) bulk.find({ _id: sessKey }).upsert().updateOne({ $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() }, $set: { windowSec: C.windowSec } });
  await bulk.execute();

  const keys = [ipKey, userKey, sessKey].filter(Boolean) as string[];
  const docs = await rateColl.find({ _id: { $in: keys } }).toArray();

  const ipCount   = docs.find(d => d._id === ipKey)?.count ?? 0;
  const userCount = userKey ? (docs.find(d => d._id === userKey)?.count ?? 0) : 0;
  const sessCount = sessKey ? (docs.find(d => d._id === sessKey)?.count ?? 0) : 0;

  if (ipCount > C.ipPerMin || (userKey && userCount > C.userPerMin) || (sessKey && sessCount > C.sessionPerMin)) {
    const res = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    // clear cookie when we know the caller is authenticated (optional)
    if (session) {
      res.cookies.set("tenant_session", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    }
    return res;
  }

  // --- daily quotas (separate collection; independent of session) ---
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

  // OK → run handler
  return handler();
}

// Keep daily quotas in a dedicated collection keyed by user+day
type DailyUsage = {
  _id: string;          // e.g. "d:sha256(email):YYYY-MM-DD"
  emailHash: string;
  date: string;         // "YYYY-MM-DD"
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

  // Ensure a doc exists (no increment here; this just checks current totals)
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
