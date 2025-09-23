
// ==========================
// app/api/things/[tenantId]/route.ts (refactored)
// Thin wrapper that keeps your current /things route behavior but
// uses safer query parsing and can be migrated to the gateway internally later.
// ==========================

import { NextRequest, NextResponse } from "next/server";
import getMongoConnection2 from "@/db/connections";
import { z } from "zod";
import { ThingBaseSchema, ThingsQuerySchema } from "@/types/things.schema";

const ThingsArray = z.array(ThingBaseSchema);

function buildFilter(tenantId: string, q: z.infer<typeof ThingsQuerySchema>) {
  const filter: Record<string, any> = { tenantId };

  if (q.searchable !== undefined) filter.searchable = q.searchable;
  filter.status = "active"; // default; remove if you want *all* statuses by default

  if (q.type) filter.type = q.type;
  if (q.q) {
    const rx = new RegExp(q.q, "i");
    filter.$or = [
      { name: rx },
      { title: rx },
      { description: rx },
      { tags: { $in: [rx] } },
      { slug: rx },
    ];
  }

  return filter;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await ctx.params;

    const sp = req.nextUrl.searchParams;
    const pick = (k: string) => {
      const v = sp.get(k);
      return v && v.trim() !== "" ? v : undefined;
    };

    const parse = ThingsQuerySchema.safeParse({
      type: pick("type"),
      q: pick("q"),
      limit: pick("limit"),
      searchable: pick("searchable"),
    });

    if (!parse.success) {
      return NextResponse.json({ error: "Invalid query", issues: parse.error.issues }, { status: 400 });
    }

    const q = parse.data;
    const limit = Math.min(q.limit ?? 100, 500);

    const { db } = await getMongoConnection2(process.env.DB!, process.env.MAINDBNAME!);

    const filter = buildFilter(tenantId, q);

    const cursor = db
      .collection("things")
      .find(filter)
      .project({ _id: 0 })
      .sort({ updatedAt: -1 })
      .limit(limit);

    const docs = await cursor.toArray();

    try {
      ThingsArray.parse(docs);
    } catch (e) {
      console.warn("[/api/things] Schema mismatch:", e);
    }

    return NextResponse.json(docs);
  } catch (err: any) {
    console.error("[/api/things] error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
