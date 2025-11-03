// /app/api/_lib/usage.ts
import type { Db, Collection } from "mongodb";
import { sha256Hex } from "@/app/api/_lib/ids";

type DailyUsage = {
  _id: string; emailHash: string; date: string;
  tokens: number; dollars: number; updatedAt: Date; createdAt: Date;
};

export async function addDailyUsage(
  db: Db,
  email: string,
  deltas: { tokens?: number; dollars?: number }
) {
  const today = new Date().toISOString().slice(0, 10);
  const emailHash = sha256Hex(email);
  const id = `d:${emailHash}:${today}`;

  const inc: any = {};
  if (deltas.tokens && deltas.tokens !== 0) inc.tokens = deltas.tokens;
  if (deltas.dollars && deltas.dollars !== 0) inc.dollars = deltas.dollars;

  await db.collection<DailyUsage>("usage_daily").updateOne(
    { _id: id },
    {
      $setOnInsert: { _id: id, emailHash, date: today, tokens: 0, dollars: 0, createdAt: new Date() },
      $set: { updatedAt: new Date() },
      ...(Object.keys(inc).length ? { $inc: inc } : {})
    },
    { upsert: true }
  );
}
