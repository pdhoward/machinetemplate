// /app/api/_lib/usage.ts
import type { Db, Collection } from "mongodb";
import { sha256Hex } from "@/app/api/_lib/ids";

type DailyUsage = {
  _id: string; 
  emailHash: string; 
  date: string; // ISO day "YYYY-MM-DD"
  tokens: number; 
  dollars: number; 
  updatedAt: Date; 
  createdAt: Date;
};


export async function addDailyUsage(
  db: Db,
  email: string,
  deltas: { tokens?: number; dollars?: number }
) {
  const today = new Date().toISOString().slice(0, 10);
  const emailHash = sha256Hex(email);
  const id = `d:${emailHash}:${today}`;

  const inc: Record<string, number> = {};
  const t = Number(deltas.tokens ?? 0);
  const d = Number(deltas.dollars ?? 0);
  if (Number.isFinite(t) && t !== 0) inc.tokens = t;
  if (Number.isFinite(d) && d !== 0) inc.dollars = d;

  // IMPORTANT: do NOT set tokens/dollars in $setOnInsert when also $inc them
  await db.collection<DailyUsage>("usage_daily").updateOne(
    { _id: id },
    {
      $setOnInsert: {
        _id: id,
        emailHash,
        date: today,
        createdAt: new Date(),
        // tokens/dollars intentionally omitted to avoid conflict with $inc
      },
      $set: { updatedAt: new Date() },
      ...(Object.keys(inc).length ? { $inc: inc } : {}),
    },
    { upsert: true }
  );
}
