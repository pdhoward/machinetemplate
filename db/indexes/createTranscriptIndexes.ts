// /db/indexes/createTranscriptIndexes.ts
import getMongoConnection from "@/db/connections";

export async function ensureTranscriptIndexes() {
  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

  await db.collection("user_transcripts").createIndex(
    { kind: 1, tenantId: 1, sessionTokenHash: 1, chunkIndex: 1 },
    { unique: true, name: "transcript_chunk_unique" }
  );

  await db.collection("user_transcripts").createIndex(
    { sessionTokenHash: 1, updatedAt: -1 },
    { name: "transcript_by_session_recent" }
  );

  await db.collection("user_transcripts").createIndex(
    { tenantId: 1, email: 1, createdAt: -1 },
    { name: "transcript_by_user_recent" }
  );
}
