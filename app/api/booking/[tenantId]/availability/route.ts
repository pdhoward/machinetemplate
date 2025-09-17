// app/api/booking/[tenantId]/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { z } from "zod";

const Query = z.object({
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  unit_id: z.string().optional(),           // optional filter
  guests: z.coerce.number().int().positive().optional()
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
    unit_id: sp.get("unit_id") ?? undefined,
    guests: sp.get("guests") ?? undefined
  });

  if (!parse.success) {
    return NextResponse.json({ ok: false, error: parse.error.issues }, { status: 400 });
  }

  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

  // For mock availability: return all active units that meet simple constraints
  const filter: any = { tenantId, type: "unit", status: "active" };
  if (parse.data.unit_id) filter.id = parse.data.unit_id;

  const units = await db.collection("things")
    .find(filter)
    .project({ _id: 0, id: 1, name: 1, rate: 1, currency: 1, sleeps: 1 })
    .toArray();

  // Mock logic: everything is available unless check_in == check_out or length <= 0
  const start = new Date(parse.data.check_in);
  const end = new Date(parse.data.check_out);
  const nights = Math.max(0, Math.ceil((+end - +start) / (1000 * 60 * 60 * 24)));

  const available = nights > 0
    ? units.filter(u => !parse.data.guests || (u.sleeps ?? 2) >= parse.data.guests!)
    : [];

  return NextResponse.json({
    ok: true,
    data: {
      check_in: parse.data.check_in,
      check_out: parse.data.check_out,
      nights,
      available_units: available
    }
  });
}
