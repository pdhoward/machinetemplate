// app/api/booking/[tenantId]/quote/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { z } from "zod";

const Query = z.object({
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unit_id: z.string()
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await ctx.params;
  const sp = req.nextUrl.searchParams;

  const parse = Query.safeParse({
    check_in: sp.get("check_in") ?? "",
    check_out: sp.get("check_out") ?? "",
    unit_id: sp.get("unit_id") ?? ""
  });

  if (!parse.success) {
    return NextResponse.json({ ok: false, error: parse.error.issues }, { status: 400 });
  }

  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  const unit = await db.collection("things").findOne(
    { tenantId, type: "unit", id: parse.data.unit_id, status: "active" },
    { projection: { _id: 0, id: 1, name: 1, rate: 1, currency: 1 } }
  );

  if (!unit) {
    return NextResponse.json({ ok: false, error: "Unit not found" }, { status: 404 });
  }

  const start = new Date(parse.data.check_in);
  const end = new Date(parse.data.check_out);
  const nights = Math.max(0, Math.ceil((+end - +start) / (1000 * 60 * 60 * 24)));
  if (nights <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid date range" }, { status: 400 });
  }

  // Mock totals (no tax/fees yet). Expand as you wish.
  const nightly = Number(unit.rate ?? 0);
  const subtotal = nightly * nights;
  const taxes = Math.round(subtotal * 0.12 * 100) / 100;
  const total = Math.round((subtotal + taxes) * 100) / 100;

  return NextResponse.json({
    ok: true,
    data: {
      unit_id: unit.id,
      unit_name: unit.name,
      currency: unit.currency ?? "USD",
      nights,
      nightly,
      subtotal,
      taxes,
      total
    }
  });
}
