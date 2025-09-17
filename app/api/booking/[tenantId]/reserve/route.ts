// app/api/booking/[tenantId]/reserve/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { z } from "zod";

const Body = z.object({
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unit_id: z.string(),
  guest: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().email(),
    phone: z.string()
  }),
  payment_token: z.string().min(6)
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parse = Body.safeParse(json);

  if (!parse.success) {
    return NextResponse.json({ ok: false, error: parse.error.issues }, { status: 400 });
  }

  // Mock “charge” and “reserve”
  const confirmation = `R${Date.now().toString().slice(-8)}`;
  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

  const reservation = {
    tenantId,
    confirmation,
    ...parse.data,
    status: "pending_payment", // or "confirmed" if you want to skip payment
    createdAt: new Date().toISOString()
  };

  await db.collection("reservations").insertOne(reservation);

  return NextResponse.json({ ok: true, data: { confirmation, status: reservation.status } });
}
