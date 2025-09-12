
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import { ThingArraySchema, ThingsQuerySchema } from "@/types/things.schema";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
 try {
    const { tenantId } = await params;
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 });
    }
    console.log(`-----------debug things----------`)
    console.log(tenantId)
    console.log(req.url)

    // Parse query (type, q, limit, searchable)
    const url = new URL(req.url);
    const queryParse = ThingsQuerySchema.safeParse({
      type: url.searchParams.get("type") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      searchable: url.searchParams.get("searchable") ?? undefined,
    });
    if (!queryParse.success) {
      return NextResponse.json({ error: "Invalid query", issues: queryParse.error.issues }, { status: 400 });
    }
    
    console.log(queryParse.data)
    const { type, q, limit = 100, searchable } = queryParse.data;

    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

    // Build filter
    const filter: Record<string, any> = { tenantId, enabled: true };
    if (type) filter.type = type;
    if (typeof searchable === "boolean") filter.searchable = searchable;
    if (q) {
      // very simple text search heuristic; adjust to your index strategy
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    const cursor = db
      .collection("things")
      .find(filter, { projection: { _id: 0 } })
      .limit(limit);

    const docs = await cursor.toArray();

    // Validate and pass through unknown fields
    const parsed = ThingArraySchema.parse(docs);

    // (Optional) If you want to return a normalized view instead, you could:
    // const views = parsed.map(toThingView);
    // return NextResponse.json(views);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("[GET /api/things/[tenantId]] error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err?.message || err) }, { status: 500 });
  }
}
