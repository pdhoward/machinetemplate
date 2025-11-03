// /app/api/_lib/session.ts
import { cookies } from "next/headers";
import crypto from "crypto";
import getMongoConnection from "@/db/connections";

// Consider adding a heartbeat endpoint to update lastSeenAt for active sessions
// and a periodic job that sets { active:false } when idle > maxSessionIdleSec
// or duration > maxSessionMinutes.

export function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function getActiveOtpSession(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tenant_session")?.value;
  if (!token) return null;

  const sessionTokenHash = sha256Hex(token);
  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

  const auth = await db.collection("auth").findOne({
    kind: "otp_session",
    sessionTokenHash,
    status: "active",
  });

  if (!auth) return null;

  return {
    sessionTokenHash,
    tenantId: auth.tenantId as string,
    email: auth.email as string,
  };
}
