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
function sanitizeFilter(filter: any) {
  if (!filter || typeof filter !== "object") return filter;

  const walk = (obj: any) => {
    if (!obj || typeof obj !== "object") return;

    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object") {
        // $regex pattern as string
        if (k === "$regex" && typeof v === "string" && v.trim() === "") {
          // Replace with a non-match or mark for deletion by parent
          obj[k] = undefined;
        } else {
          walk(v);
        }
      }
    }

    // Clean up undefined keys created above
    for (const key of Object.keys(obj)) {
      if (obj[key] === undefined) delete obj[key];
    }

    // Remove empty $or
    if (Array.isArray(obj.$or)) {
      obj.$or = obj.$or
        .map((clause: any) => {
          // remove $regex "" within each clause
          if (clause && typeof clause === "object") {
            walk(clause);
            return Object.keys(clause).length === 0 ? null : clause;
          }
          return clause;
        })
        .filter(Boolean);

      if (obj.$or.length === 0) delete obj.$or;
    }
  };

  walk(filter);
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
