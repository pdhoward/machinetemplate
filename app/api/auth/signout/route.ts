// app/api/auth/signout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import getMongoConnection from "@/db/connections";

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** If you already have this elsewhere, import it instead */
async function getTenantMongoSecrets(tenantId: string | null): Promise<{ uri: string; dbName: string }> {
  const uri = process.env.DB || "";
  const dbName = process.env.MAINDBNAME || "";
  if (!uri || !dbName) throw new Error("Missing Mongo credentials in environment variables");
  return { uri, dbName };
}

export async function POST() {
  const c = await cookies();
  const token = c.get("tenant_session")?.value || null;

  // Always clear cookie regardless of DB update outcome
  c.set("tenant_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  if (!token) {
    return NextResponse.json({ ok: true });
  }

  // Try to verify (best), then decode (fallback) to recover tenantId
  let tenantId: string | null = null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    tenantId = payload?.tenantId ?? null;
  } catch {
    try {
      const payload = jwt.decode(token) as any;
      tenantId = payload?.tenantId ?? null;
    } catch {
      tenantId = null;
    }
  }

  try {
    const tokenHash = sha256Hex(token);
    const { uri, dbName } = await getTenantMongoSecrets(tenantId);
    const { db } = await getMongoConnection(uri, dbName);

    // Find the active session by token hash and close it
    const doc = await db.collection("auth").findOne({
      kind: "otp_session",
      sessionTokenHash: tokenHash,
      status: "active",
    });

    if (doc) {
      const now = new Date();
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
    // Swallow DB errors here; cookie is already cleared
  }

  return NextResponse.json({ ok: true });
}
