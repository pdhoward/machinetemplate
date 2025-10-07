// app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { genSixDigit, hashCode, makeChallengeToken } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email/transporter";

export async function POST(req: NextRequest) {
  try {
    const { email, tenantId } = await req.json();

    if (!email || !tenantId) {
      return NextResponse.json({ error: "Missing email or tenantId" }, { status: 400 });
    }

    const code = genSixDigit();
    const codeHash = hashCode(code, email);
    const challengeToken = makeChallengeToken(email, tenantId, codeHash);
    
    // fire and forget email
    await sendOtpEmail(email, code);

    return NextResponse.json({ ok: true, challengeToken });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to send OTP" }, { status: 500 });
  }
}
