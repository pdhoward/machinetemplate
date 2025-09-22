import { NextRequest, NextResponse } from "next/server";
import getMongoConnection  from "@/db/connections";
import {
  ToolRegistryArraySchema,
  type ToolRegistryItem,
} from "@/types/toolRegistry.schema";

/**
 * GET /api/tools/fetch/:tenantId
 * Returns validated, normalized tool registry items for a tenant.
 * Source collection: "actions"
 */

export async function GET( req: NextRequest, { params }: { params: Promise<{ tenantId: string }> } ) {
  
  const {tenantId} = await params
  
  try {    

    if (!tenantId) {
      return NextResponse.json(
        { ok: false, error: "tenantId is required" },
        { status: 400 }
      );
    }

    const {db} = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

    // Pull all enabled items for the tenant
    const rows = await db
      .collection("actions")
      .find({ tenantId, enabled: { $ne: false } })
      .toArray();

    // Normalize Mongo-specific fields and number wrappers
    const normalized = rows.map((r) => {
      const { _id, ...rest } = r as Record<string, any>;

      // unwrap {$numberInt: "..."} etc.
      const unwrap = (v: any) =>
        v && typeof v === "object" && "$numberInt" in v
          ? parseInt(v.$numberInt, 10)
          : v;

      if (rest.version) rest.version = unwrap(rest.version);
      if (rest.http?.timeoutMs) rest.http.timeoutMs = unwrap(rest.http.timeoutMs);

      return rest;
    });

    // Validate with Zod (and narrow typing)
    const validated: ToolRegistryItem[] =
      ToolRegistryArraySchema.parse(normalized);

    return NextResponse.json(validated, { status: 200 });
  } catch (err: any) {
    console.error("[tools/fetch] error:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
