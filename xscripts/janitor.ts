// scripts/janitor.ts
import { MongoClient } from "mongodb";

const MAX_MIN = Number(process.env.MAX_SESSION_MINUTES ?? 15);
const MAX_IDLE_SEC = Number(process.env.MAX_SESSION_IDLE_SEC ?? 300);

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db(process.env.MAINDBNAME!);
  const coll = db.collection("realtime_sessions");

  const now = new Date();
  const idleCutoff = new Date(Date.now() - MAX_IDLE_SEC * 1000);
  const ageCutoff  = new Date(Date.now() - MAX_MIN * 60 * 1000);

  // 1) Mark idle sessions inactive
  const r1 = await coll.updateMany(
    { active: true, lastSeenAt: { $lt: idleCutoff } },
    { $set: { active: false } }
  );

  // 2) Mark over-duration sessions inactive
  const r2 = await coll.updateMany(
    { active: true, startedAt: { $lt: ageCutoff } },
    { $set: { active: false } }
  );

  console.log(`[janitor] idleClosed=${r1.modifiedCount} overTimeClosed=${r2.modifiedCount} @ ${now.toISOString()}`);
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
