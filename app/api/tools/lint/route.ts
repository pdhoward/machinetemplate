// app/api/tools/lint/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import getMongoConnection  from "@/db/connections";
import { lintHttpToolDescriptors, LINTER_VERSION } from "@/lib/validator/lint-tools";

export const runtime = "nodejs";

const BodySchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  // Optional filter — pass onlyEnabled=true if you want only enabled tools
  onlyEnabled: z.boolean().default(false),  // Changed default to false to lint all by default
});

function unwrapMongoExtendedJSON(v: any): any {
  if (Array.isArray(v)) return v.map(unwrapMongoExtendedJSON);
  if (v && typeof v === "object") {
    // number types
    if ("$numberInt" in v) return parseInt(v.$numberInt, 10);
    if ("$numberLong" in v) return parseInt(v.$numberLong, 10);
    if ("$numberDouble" in v) return parseFloat(v.$numberDouble);
    if ("$numberDecimal" in v) return Number(v.$numberDecimal);// recurse

  const out: Record<string, any> = {};

  for (const [k, val] of Object.entries(v)) out[k] = unwrapMongoExtendedJSON(val);

  return out;  
}
  return v;
}

export async function POST(req: NextRequest) {  
  console.log("[admin-lint] using", LINTER_VERSION);  
  try {

    const json = await req.json().catch(() => ({}));
    const { tenantId, onlyEnabled } = BodySchema.parse(json);
    const {db} = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

    // Pull all http_tool docs for the tenant (optionally only enabled)
    const query: Record<string, any> = { kind: "http_tool", tenantId };
    if (onlyEnabled) query.enabled = true;  // Only filter if explicitly requested

  const rows = await db
    .collection("actions")
    .find(query)
    .toArray();

  //console.log("[admin-lint] query", query, "rows:", rows.length);

  // Normalize Mongo-specific fields and number wrappers
  const normalized = rows.map((r) => {
    const { _id, ...rest } = r as Record<string, any>;
    return unwrapMongoExtendedJSON(rest);
  });

  // Lint all normalized documents (linter now handles schema validation as issues)
  const report = lintHttpToolDescriptors(normalized);  // Pass as any[], linter will validate

  // Summaries for the admin UI
  const total = normalized.length;
  const totalErrors = report.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === "error").length,
    0
  );
  const totalWarnings = report.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === "warning").length,
    0
  );

  return NextResponse.json({
    ok: true,
    linterVersion: LINTER_VERSION,
    meta: { tenantId, total, totalErrors, totalWarnings, invalid: 0 },  // No separate invalid, all in report
    invalid: [],  // Removed, as schema errors are now linter issues
    report,       // Structured lint results (per descriptor, including schema fails)
  });  
} catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "server_error" },
      { status: 400 }
    );
  }
}

