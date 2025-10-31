// /app/api/_lib/ids.ts
// Edge-safe, synchronous hashing & base64url parsing using crypto-es (ESM).
import { Utf8, SHA256, Base64 } from 'crypto-es'

/** sha256 -> hex (sync, Edge-safe) */
export function sha256Hex(s: string): string {
  // SHA256(...).toString() returns hex by default
  return SHA256(s).toString();
}

/** Best-effort IP from headers (Edge-safe) */

export function ipFromHeaders(req: Request): string {
  const h = new Headers(req.headers);
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-vercel-ip") ||
    "";
  // Map IPv6 loopback to IPv4 loopback
  if (raw === "::1" || raw === "0:0:0:0:0:0:0:1") return "127.0.0.1";
  return raw || "0.0.0.0";
}


/** Extract email from JWT cookie without Node Buffer/atob (Edge-safe) */
export function emailFromJwtCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)tenant_session=([^;]+)/);
  if (!m) return null;
  try {
    const token = m[1];
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadJson = base64urlToUtf8(parts[1]);
    const payload = JSON.parse(payloadJson);
    return payload?.email ?? null;
  } catch {
    return null;
  }
}

function base64urlToUtf8(b64url: string): string {
  // Convert base64url -> base64 (pad to multiple of 4)
  const b64 =
    b64url.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice((4 - (b64url.length % 4)) % 4);

  const wordArray = Base64.parse(b64);     // crypto-es WordArray
  return Utf8.stringify(wordArray);        // UTF-8 decoded string
}
