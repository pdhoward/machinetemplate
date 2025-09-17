// app/api/things/[tenantId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { z } from "zod";
import { ThingBaseSchema, ThingsQuerySchema } from "@/types/things.schema";

const ThingsArray = z.array(ThingBaseSchema);

// Build a safe query object from parsed params
function buildFilter(tenantId: string, q: z.infer<typeof ThingsQuerySchema>) {
  const filter: Record<string, any> = { tenantId };

  // Prefer status=active over non-existent `enabled: true`
  // Only apply if the doc uses `status` (it's optional in schema)
  if (q.searchable !== undefined) {
    filter.searchable = q.searchable;
  }

  // If you want only "active" by default, add it:
  filter.status = "active"; // default; remove if you want *all* statuses by default

  if (q.type) {
    filter.type = q.type;
  }

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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await ctx.params;

    // read & validate query string
    const sp = req.nextUrl.searchParams;
    const parse = ThingsQuerySchema.safeParse({
      type: sp.get("type") ?? undefined,
      q: sp.get("q") ?? undefined,
      limit: sp.get("limit") ?? undefined,
      searchable: sp.get("searchable") ?? undefined,
    });

    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid query", issues: parse.error.issues },
        { status: 400 }
      );
    }

    const q = parse.data;

    // defaults
    const limit = Math.min(q.limit ?? 100, 500); // default 100, max 500

    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

    const filter = buildFilter(tenantId, q);

    const cursor = db.collection("things")
      .find(filter)
      .project({ _id: 0 })
      .sort({ updatedAt: -1 })   // newest first
      .limit(limit);

    const docs = await cursor.toArray();

    // Optional: validate server output (skip if perf sensitive)
    // If it ever throws during dev, you’ll know a doc is malformed.
    // In prod, you might switch to .safeParse and log instead.
    try {
      ThingsArray.parse(docs);
    } catch (e) {
      // don’t fail the request, but surface the issue
      console.warn("[/api/things] Schema mismatch:", e);
    }

    return NextResponse.json(docs);
  } catch (err: any) {
    console.error("[/api/things] error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
