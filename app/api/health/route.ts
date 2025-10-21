// app/api/health/route.ts
import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  if (client) return client;
  if (connecting) return connecting;

  const uri = process.env.DB; // Mongo Atlas connection
  
  if (!uri) throw new Error("MONGODB_URI not set");

  connecting = (async () => {
    const c = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
    await c.connect();
    client = c;
    connecting = null;
    return c;
  })();

  return connecting;
}

export async function GET() {
  try {
    let c = await getClient();
    const maindbname = process.env.MAINDBNAME

    // lightweight health check
    try {
      await c.db(maindbname).command({ ping: 1 });
    } catch(e) {
      // Stale/broken connection? Recreate once and try again.
      console.log(`DATABASE TEST FAILED WITH ${e}`)
      client = null;
      c = await getClient();
      await c.db("admin").command({ ping: 1 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "db error" },
      { status: 503 }
    );
  }
}
