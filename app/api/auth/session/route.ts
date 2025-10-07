// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const t = cookieStore.get("tenant_session")?.value;
  if (!t) return NextResponse.json({ token: null }, { status: 200 });

  try {
    jwt.verify(t, JWT_SECRET);
    return NextResponse.json({ token: t }, { status: 200 });
  } catch {
    return NextResponse.json({ token: null }, { status: 200 });
  }
}
