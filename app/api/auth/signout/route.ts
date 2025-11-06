// app/api/auth/signout/route.ts
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getActiveOtpSession } from "@/app/api/_lib/session"; 
import { sha256Hex } from "@/app/api/_lib/ids"; 
import getMongoConnection from "@/db/connections";

// function sha256Hex(s: string) {
//   return crypto.createHash("sha256").update(s).digest("hex");
// }
type RealtimeSessionDoc = {
  _id: string;
  emailHash: string;
  startedAt: Date;
  lastSeenAt: Date;
  active: boolean;
};

export async function POST(req: NextRequest) {
  const c = await cookies();
  const token = c.get("tenant_session")?.value || null;

  const sess = await getActiveOtpSession(req as any);
  if (!sess) {
    return NextResponse.json({ error: "No active session" }, { status: 401 });
  }

  const emailHash = sha256Hex(sess.email);

  // Always clear the cookie first (client locked out regardless of DB outcome)
  c.set("tenant_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  if (!token) return NextResponse.json({ ok: true });

  // We don’t *need* tenantId to finalize; we use the session token hash
  const tokenHash = sha256Hex(token);

  // (Optional) Try to decode to log or for analytics
  let tenantId: string | null = null;
  try {
    tenantId = (jwt.verify(token, process.env.JWT_SECRET!) as any)?.tenantId ?? null;
  } catch {
    try { tenantId = (jwt.decode(token) as any)?.tenantId ?? null; } catch {}
  }

  try {
    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    const now = new Date();

    // 1) Finalize any open transcript chunks for this session (idempotent)
    await db.collection("user_transcripts").updateMany(
      {
        kind: "user_transcript_chunk",
        sessionTokenHash: tokenHash,
        finalizedAt: { $exists: false },
      },
      { $set: { finalizedAt: now, updatedAt: now } }
    );

     const sessions = db.collection<RealtimeSessionDoc>("realtime_sessions");

      // 2) Update all matching sessions in active session tracker to active: false
      const updateResult = await sessions.updateMany(
        { emailHash, active: true },
        { $set: { active: false } }
      );
      console.log(`Updated ${updateResult.modifiedCount} sessions to inactive for emailHash: ${emailHash}`)

    // 2.1) Close the auth session (also idempotent: only if active)
    const doc = await db.collection("auth").findOne({
      kind: "otp_session",
      sessionTokenHash: tokenHash,
      status: "active",
    });

    if (doc) {
      const started = doc.sessionIssuedAt ? new Date(doc.sessionIssuedAt) : now;
      const durationSec = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));
      await db.collection("auth").updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "ended",
            sessionEndedAt: now,
            durationSec,
            lastSeenAt: now,
          },
        }
      );
    }
  } catch {
    // swallow DB errors; cookie is already cleared
  }

  return NextResponse.json({ ok: true });
}
