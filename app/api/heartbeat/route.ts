// /app/api/session/heartbeat/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { getActiveOtpSession } from "@/app/api/_lib/session";
import { sha256Hex } from "@/app/api/_lib/ids";

type RealtimeSessionDoc = {
  _id: string;           // <-- string, not ObjectId
  emailHash: string;
  startedAt: Date;
  lastSeenAt: Date;
  active: boolean;
};

export async function POST(req: NextRequest) {
  const sess = await getActiveOtpSession(req as any);
  if (!sess) return NextResponse.json({ error: "No active session" }, { status: 401 });

  const { sm_session_id } = await req.json().catch(() => ({}));
  if (!sm_session_id) return NextResponse.json({ error: "Missing sm_session_id" }, { status: 400 });

  const emailHash = sha256Hex(sess.email);
  const _id = `s:${emailHash}:${sm_session_id}`;

  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  const sessions = db.collection<RealtimeSessionDoc>("realtime_sessions"); // <-- typed

  await sessions.updateOne(
    { _id },                                        // now _id is correctly string-typed
    { $set: { lastSeenAt: new Date() } }
  );

  return NextResponse.json({ ok: true });
}
