// app/api/tools/lint/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import getMongoConnection  from "@/db/connections";
import {
  HttpToolDescriptorSchema,
  type HttpToolDescriptor,
} from "@/types/httpTool.schema";
import { lintHttpToolDescriptors, LINTER_VERSION } from "@/lib/validator/lint-tools";

export const runtime = "nodejs";

const BodySchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  // Optional filter — pass enabled=false if you want everything
  onlyEnabled: z.boolean().default(true),
});

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

export async function POST(req: NextRequest) {
  
  console.log("[admin-lint] using", LINTER_VERSION);

  try {
    const json = await req.json().catch(() => ({}));
    const { tenantId, onlyEnabled } = BodySchema.parse(json);

    const {db} = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);

    // Pull all enabled items for the tenant
    const rows = await db
      .collection("actions")
      .find({ tenantId, enabled: { $ne: false } })
      .toArray();
    // Pull http_tool docs for the tenant (optionally only enabled)
    const query: Record<string, any> = { kind: "http_tool", tenantId };
    if (onlyEnabled) query.enabled = true;

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

      return unwrapMongoExtendedJSON(rest);
    });

    // Validate each doc with Zod (only keep valid)
    const tools: HttpToolDescriptor[] = [];
    const invalid: Array<{ _id: string; reason: string }> = [];

    for (const d of normalized) {
      const parsed = HttpToolDescriptorSchema.safeParse(d);
      if (parsed.success) tools.push(parsed.data);
      else invalid.push({
        _id: String((d as any)._id),
        reason: parsed.error.message,
      });
    }

    // Lint the valid ones
    const report = lintHttpToolDescriptors(tools);

    // Summaries for the admin UI
    const total = tools.length;
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
      meta: { tenantId, total, totalErrors, totalWarnings, invalid: invalid.length },
      invalid,   // zod-rejected docs with reasons (useful to fix schema drift)
      report,    // structured lint results (per descriptor)
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "server_error" },
      { status: 400 }
    );
  }
}
