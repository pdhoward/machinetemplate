// /types/transcript.ts
export type TranscriptRole = "user" | "assistant" | "tool" | "system";

export interface TranscriptMessage {
  id: string;                // same id from your conversation array
  role: TranscriptRole;
  text?: string;
  ts: number;                // epoch ms (Number), faster than Date in hot paths
  meta?: Record<string, any>;
}

export interface UserTranscriptChunk {  
  kind: "user_transcript_chunk";
  tenantId: string;
  sessionTokenHash: string;  // sha256(sessionToken) (never store raw token)
  email?: string | null;

  // chunking
  chunkIndex: number;        // 0,1,2...
  count: number;             // messages in this chunk
  byteSize: number;          // rough running size in bytes
  messages: TranscriptMessage[];

  // lifecycle
  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date | null; // set on session end
}
