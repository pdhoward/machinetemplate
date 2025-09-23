// ==========================
// app/api/mongo/gateway/route.ts
// Generic server-side Mongo gateway for safe, descriptor-driven calls.
// Supports op: "find" and "aggregate". Credentials are resolved server-side
// per-tenant; descriptors should *never* contain raw DB creds.
// ==========================

"use server";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import getMongoConnection from "@/db/connections";

// --- JSON value schema (kept local for convenience) ------------------------
const JsonValue: z.ZodType<any> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(JsonValue)])
);

// --- Request schemas --------------------------------------------------------

const DbTargetSchema = z.object({
  dbName: z.string().optional(), // fallback to tenant default
  collection: z.string().min(1),
});

const FindReqSchema = z.object({
  op: z.literal("find"),
  tenantId: z.string().min(1),
  db: DbTargetSchema,
  filter: JsonValue.optional(),
  projection: JsonValue.optional(),
  sort: JsonValue.optional(),
   limit: z.coerce.number().int().min(1).max(500).optional(),
});

const AggregateReqSchema = z.object({
  op: z.literal("aggregate"),
  tenantId: z.string().min(1),
  db: DbTargetSchema,
  pipeline: z.array(JsonValue).min(1),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const GatewaySchema = z.discriminatedUnion("op", [FindReqSchema, AggregateReqSchema]);

// --- Secrets resolution (stub; replace with your per-tenant store) ---------
async function getTenantMongoSecrets(tenantId: string): Promise<{ uri: string; dbName: string }>{
  // TODO: look up tenant in your own collection, e.g. db.collection("tenants").findOne({ tenantId })
  // For now, fallback to envs you already use elsewhere.
  const uri = process.env.DB || ""; // e.g., mongodb+srv://...
  const dbName = process.env.MAINDBNAME || ""; // e.g., strategic_machines
  if (!uri || !dbName) {
    throw new Error("Missing Mongo credentials in environment variables");
  }
  return { uri, dbName };
}

// --- Safety: deny dangerous operators in filters/pipelines -----------------
const DISALLOWED_KEYS = new Set<string>([
  "$where",
  "$accumulator",
  "$function",
  "$regexFindAll",
  "$regexFind",
  // Add more if needed
]);

function scanForDisallowedKeys(v: any, path: string[] = []): void {
  if (!v || typeof v !== "object") return;
  for (const [k, val] of Object.entries(v)) {
    if (k.startsWith("$") && DISALLOWED_KEYS.has(k)) {
      throw new Error(`Disallowed operator ${k} at ${path.concat(k).join(".")}`);
    }
    scanForDisallowedKeys(val, path.concat(k));
  }
}

// --- Helpers ---------------------------------------------------------------

// OPTIONAL: tidy filter — drop $regex with empty patterns, remove empty $or arrays
function sanitizeFilter(filter: unknown) {
  if (!filter || typeof filter !== "object") return filter;

  const walk = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      // 1) Handle $regex as a string value (driver-style)
      if (k === "$regex") {
        if (typeof v === "string" && v.trim() === "") {
          delete (obj as any)[k];
          continue;
        }
        // keep non-empty string or other accepted forms (RegExp, etc.)
        continue;
      }

      // 2) Handle Atlas-style $regularExpression: { pattern, options }
      if (k === "$regularExpression" && v && typeof v === "object") {
        const pat = (v as any).pattern;
        if (typeof pat === "string" && pat.trim() === "") {
          delete (obj as any)[k];
          continue;
        }
        // keep if non-empty; still descend into it in case there are nested bits
        walk(v as Record<string, unknown>);
        continue;
      }

      // 3) Recurse into nested objects/arrays
      if (v && typeof v === "object") {
        walk(v as Record<string, unknown>);
      }
    }

    // 4) Remove empty $or clauses ([], [{}], etc.)
    if (Array.isArray((obj as any).$or)) {
      (obj as any).$or = (obj as any).$or
        .map((clause: unknown) => {
          if (clause && typeof clause === "object") {
            walk(clause as Record<string, unknown>);
            return Object.keys(clause as Record<string, unknown>).length > 0 ? clause : null;
          }
          return clause;
        })
        .filter(Boolean);
      if ((obj as any).$or.length === 0) delete (obj as any).$or;
    }
  };

  walk(filter as Record<string, unknown>);
  return filter;
}


function coerceLimit(requested: number | undefined, fallback = 100, max = 500) {
  const n = typeof requested === "number" ? requested : fallback;
  return Math.min(Math.max(1, n), max);
}

export async function POST(req: NextRequest) {
  // Correlate logs across hops
  const traceId = req.headers.get("x-trace-id") ?? `gw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  try {
    const bodyText = await req.text();
    console.log(`[GATEWAY] ${traceId} raw`, bodyText);

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
    }

    const parsed = GatewaySchema.safeParse(body);
    if (!parsed.success) {
      console.error(`[GATEWAY] ${traceId} zod issues`, parsed.error.issues);
      return NextResponse.json({ ok: false, error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const input = parsed.data;
    const { uri, dbName: defaultDb } = await getTenantMongoSecrets(input.tenantId);
    const { db } = await getMongoConnection(uri, input.db.dbName || defaultDb);

    if (input.op === "find") {
      const limit = coerceLimit(input.limit);
      const filter = sanitizeFilter(input.filter ?? {});
      scanForDisallowedKeys(filter);

      console.log(`[GATEWAY] ${traceId} op=find`, {
        tenantId: input.tenantId,
        coll: input.db.collection,
        limit,
        filter,
        projection: input.projection,
        sort: input.sort,
      });

      const cursor = db
        .collection(input.db.collection)
        .find(filter)
        .project(input.projection ?? undefined)
        .sort(input.sort ?? undefined)
        .limit(limit);

      const docs = await cursor.toArray();
      console.log(`[GATEWAY] ${traceId} result_count=${docs.length}`);
      return NextResponse.json(docs, { status: 200 });
    }

    if (input.op === "aggregate") {
      const limit = coerceLimit(input.limit);
      scanForDisallowedKeys(input.pipeline);

      const hasLimit = input.pipeline.some((stage: any) => stage && "$limit" in stage);
      const finalPipeline = hasLimit ? input.pipeline : [...input.pipeline, { $limit: limit }];

      console.log(`[GATEWAY] ${traceId} op=aggregate`, {
        tenantId: input.tenantId,
        coll: input.db.collection,
        limit,
        pipeline: finalPipeline,
      });

      const docs = await db.collection(input.db.collection).aggregate(finalPipeline, { allowDiskUse: false }).toArray();
      console.log(`[GATEWAY] ${traceId} result_count=${docs.length}`);
      return NextResponse.json(docs, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "Unsupported op" }, { status: 400 });
  } catch (err: any) {
    console.error(`[GATEWAY] ${traceId} error`, err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
