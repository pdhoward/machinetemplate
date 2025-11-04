// /app/api/usage/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { getActiveOtpSession } from "@/app/api/_lib/session";
import { addDailyUsage } from "@/app/api/_lib/usage";
import { estimateRealtimeUSD } from "@/config/costmodel";

// Optional: very light body guard
function toNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function POST(req: NextRequest) {
  // Identify user via OTP cookie
  const sess = await getActiveOtpSession(req as any);
  if (!sess) {
    return NextResponse.json({ error: "No active session" }, { status: 401 });
  }

  // Body: { text_in, text_out, audio_in, audio_out, sm_session_id? }
  const body = await req.json().catch(() => ({} as any));
  const text_in   = toNum(body.text_in);
  const text_out  = toNum(body.text_out);
  const audio_in  = toNum(body.audio_in);
  const audio_out = toNum(body.audio_out);

  const tokens = text_in + text_out + audio_in + audio_out;
  if (tokens <= 0) {
    // No-op update is fine; return quickly
    return NextResponse.json({ ok: true, tokens: 0, dollars: 0 });
  }

  const dollars = estimateRealtimeUSD({
    textIn:  text_in,
    textOut: text_out,
    audioIn: audio_in,
    audioOut: audio_out,
  });

  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  await addDailyUsage(db, sess.email, { tokens, dollars });

  // You could also log sm_session_id here for auditing if provided:
  // const smSessionId = typeof body.sm_session_id === "string" ? body.sm_session_id : null;

  return NextResponse.json({ ok: true, tokens, dollars });
}
