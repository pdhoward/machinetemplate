// /app/api/transcripts/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { getActiveOtpSession } from "@/app/api/_lib/session";

export async function POST(req: NextRequest) {
  try {
    const sess = await getActiveOtpSession(req as any);
    if (!sess) return NextResponse.json({ error: "No active session" }, { status: 401 });

    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    const coll = db.collection("user_transcripts");

    const now = new Date();
    const res = await coll.updateMany(
      {
        kind: "user_transcript_chunk",
        tenantId: sess.tenantId,
        sessionTokenHash: sess.sessionTokenHash,
        finalizedAt: { $exists: false },
      },
      { $set: { finalizedAt: now, updatedAt: now } }
    );

    return NextResponse.json({ ok: true, modified: res.modifiedCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "finalize failed" }, { status: 500 });
  }
}
