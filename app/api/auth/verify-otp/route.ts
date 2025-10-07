// app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { hashCode, verifyChallengeToken, makeSessionToken } from "@/lib/auth/otp";
import getMongoConnection from "@/db/connections";

/** If you already have this elsewhere, import it instead */
async function getTenantMongoSecrets(tenantId: string): Promise<{ uri: string; dbName: string }> {
  const uri = process.env.DB || "";
  const dbName = process.env.MAINDBNAME || "";
  if (!uri || !dbName) throw new Error("Missing Mongo credentials in environment variables");
  return { uri, dbName };
}

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function maskCode(code: string) {
  return code.slice(0, 2) + "••••";
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, challengeToken, tenantId } = await req.json();

    if (!email || !code || !challengeToken || !tenantId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const payload = verifyChallengeToken(challengeToken);
    if (payload.sub !== "otp_challenge") {
      return NextResponse.json({ error: "Invalid challenge" }, { status: 400 });
    }
    if (payload.email !== email || payload.tenantId !== tenantId) {
      return NextResponse.json({ error: "Mismatched challenge" }, { status: 400 });
    }

    const providedHash = hashCode(code, email);
    if (providedHash !== payload.codeHash) {
      return NextResponse.json({ error: "Incorrect code" }, { status: 401 });
    }

    // OK — mint session token
    const sessionToken = makeSessionToken(email, tenantId);

    // Persist session to Mongo (multitenant-aware)
    const { uri, dbName } = await getTenantMongoSecrets(tenantId);
    const { db } = await getMongoConnection(uri, dbName);

    const now = new Date();
    const sessionDoc = {
      kind: "otp_session",
      tenantId,
      email,
      codeMasked: maskCode(code),           // human-friendly audit
      codeHash: providedHash,               // hash(email + code) from your otp lib
      sessionTokenHash: sha256Hex(sessionToken),
      sessionIssuedAt: now,
      sessionExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers.get("user-agent") || null,
      ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
      status: "active" as const,
      lastSeenAt: now, // reserved for future heartbeat
    };

    await db.collection("auth").insertOne(sessionDoc);

    // Set HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("tenant_session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({ ok: true, sessionToken });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Verification failed" }, { status: 500 });
  }
}
