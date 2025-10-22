// src/app/api/tools/fetch/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import {
  ToolRegistryArraySchema,
  type ToolRegistryItem,
} from "@/types/toolRegistry.schema";
import { lintHttpToolDescriptors, LINTER_VERSION } from "@/lib/validator/lint-tools";

/**
 * GET /api/tools/fetch/:tenantId
 * Returns validated, normalized tool registry items for a tenant.
 * Source collection: "actions"
 */

function unwrapMongoExtendedJSON(v: any): any {
  if (Array.isArray(v)) return v.map(unwrapMongoExtendedJSON);
  if (v && typeof v === "object") {
    // number types
    if ("$numberInt" in v) return parseInt(v.$numberInt, 10);
    if ("$numberLong" in v) return parseInt(v.$numberLong, 10);
    if ("$numberDouble" in v) return parseFloat(v.$numberDouble);
    if ("$numberDecimal" in v) return Number(v.$numberDecimal);

    // recurse
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) out[k] = unwrapMongoExtendedJSON(val);
    return out;
  }
  return v;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  
  const { tenantId } = await params;
  
  try {    
    if (!tenantId) {
      throw new Error("tenantId is required");
    }

    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

    // Pull all enabled items for the tenant
    const rows = await db
      .collection("actions")
      .find({ tenantId, enabled: { $ne: false } })
      .toArray();

    // Normalize Mongo-specific fields and number wrappers
    const normalized = rows.map((r) => {
      const { _id, ...rest } = r as Record<string, any>;
      return unwrapMongoExtendedJSON(rest);
    });

    // Run linter on normalized items (handles schema validation and other checks)
    const report = lintHttpToolDescriptors(normalized);

    // Check for any error-severity issues
    const errorIssues = report.flatMap(r => r.issues.filter(i => i.severity === "error"));
    if (errorIssues.length > 0) {
      const summary = errorIssues.map(i => `${i.code} at ${i.path}: ${i.message}`).join("; ");
      throw new Error(`Lint errors detected: ${summary}`);
    }

    // If no errors, validate with Zod (redundant but kept for type narrowing)
    const validated: ToolRegistryItem[] = ToolRegistryArraySchema.parse(normalized);

    return NextResponse.json(validated, { status: 200 });
  } catch (err: any) {
    console.error("[tools/fetch] error:", err);
    // In Next.js API routes, throwing errors results in a 500 response with { error: message }
    // If called from a page, error.tsx can catch and display it user-friendly
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}