// app/api/auth/usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import getMongoConnection from "@/db/connections";
import jwt from "jsonwebtoken";

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { tokens = 0, dollars = 0 } = body;

  const c = await cookies();
  const token = c.get("tenant_session")?.value;
  if (!token) return NextResponse.json({ error: "No session" }, { status: 401 });

  // verify or (fallback) decode to get tenantId/email
  let tenantId: string | null = null;
  let email: string | null = null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    tenantId = payload?.tenantId ?? null;
    email = payload?.email ?? null;
  } catch {
    const payload = jwt.decode(token) as any;
    tenantId = payload?.tenantId ?? null;
    email = payload?.email ?? null;
  }

  const tokenHash = sha256Hex(token);
  const { uri, dbName } = await getTenantMongoSecrets(tenantId || "");
  const { db } = await getMongoConnection(uri, dbName);

  await db.collection("auth").updateOne(
    { sessionTokenHash: tokenHash, status: "active" },
    {
      $inc: {
        "usage.tokens": tokens,
        "usage.dollars": dollars,
      },
      $setOnInsert: { tenantId, email, createdAt: new Date() },
      $set: { lastSeenAt: new Date() },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
