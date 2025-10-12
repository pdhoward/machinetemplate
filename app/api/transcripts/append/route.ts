// /app/api/transcripts/append/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { getActiveOtpSession } from "@/app/api/_lib/session";
import type { UpdateFilter } from "mongodb";
import type { UserTranscriptChunk, TranscriptMessage } from "@/types/transcript";

const MAX_MSGS_PER_CHUNK = 250;
const MAX_BYTES_PER_CHUNK = 1_000_000;

function roughSizeOf(obj: any) {
  try { return JSON.stringify(obj).length; } catch { return 1024; }
}

export async function POST(req: NextRequest) {
  try {
    const sess = await getActiveOtpSession(req as any);
    if (!sess) return NextResponse.json({ error: "No active session" }, { status: 401 });

    const payload = await req.json();
    const messages = (Array.isArray(payload?.messages) ? payload.messages : []) as TranscriptMessage[];
    if (!messages.length) return NextResponse.json({ ok: true, appended: 0 });

    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    const coll = db.collection<UserTranscriptChunk>("user_transcripts");

    const last = await coll.findOne(
      {
        kind: "user_transcript_chunk",
        tenantId: sess.tenantId,
        sessionTokenHash: sess.sessionTokenHash,
      },
      { sort: { chunkIndex: -1 } }
    );

    let chunkIndex = last?.chunkIndex ?? 0;
    let count = last?.count ?? 0;
    let byteSize = last?.byteSize ?? 0;

    const incomingSize = roughSizeOf(messages);
    const needRollover =
      !last ||
      last.finalizedAt != null ||
      count + messages.length > MAX_MSGS_PER_CHUNK ||
      byteSize + incomingSize > MAX_BYTES_PER_CHUNK;

    if (needRollover) {
      chunkIndex = (last?.chunkIndex ?? -1) + 1;
      count = 0;
      byteSize = 0;
    }

    const now = new Date();
    const filter = {
      kind: "user_transcript_chunk" as const,
      tenantId: sess.tenantId,
      sessionTokenHash: sess.sessionTokenHash,
      chunkIndex,
    };

    const update: UpdateFilter<UserTranscriptChunk> = {
      $setOnInsert: {
        kind: "user_transcript_chunk",
        tenantId: sess.tenantId,
        sessionTokenHash: sess.sessionTokenHash,
        email: sess.email ?? null,
        chunkIndex,
        createdAt: now,
      },
      $push: { messages: { $each: messages } },
      $set: { updatedAt: now },
      $inc: { count: messages.length, byteSize: incomingSize },
    };

    await coll.updateOne(filter, update, { upsert: true });

    return NextResponse.json({ ok: true, chunkIndex, appended: messages.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "append failed" }, { status: 500 });
  }
}
