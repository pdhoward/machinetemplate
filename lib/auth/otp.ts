// lib/auth/otp.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("JWT_SECRET is not set! Add it to your env.");
}

export function genSixDigit(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashCode(code: string, email: string) {
  return crypto.createHmac("sha256", JWT_SECRET).update(`${email}:${code}`).digest("hex");
}

/**
 * Create a short-lived challenge token that embeds the email, tenantId, and hash(code)
 */
export function makeChallengeToken(email: string, tenantId: string, codeHash: string) {
  return jwt.sign(
    { sub: "otp_challenge", email, tenantId, codeHash },
    JWT_SECRET,
    { expiresIn: "10m" }
  );
}

export function verifyChallengeToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; tenantId: string; codeHash: string };
}

/**
 * Create a tenant session token (longer lived) after successful OTP
 */
export function makeSessionToken(email: string, tenantId: string) {
  return jwt.sign(
    { sub: "tenant_session", email, tenantId },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
