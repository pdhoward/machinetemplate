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

// helper
const CoercedLimit = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().int().min(1).max(500).optional()
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
  limit: CoercedLimit, 
});

const AggregateReqSchema = z.object({
  op: z.literal("aggregate"),
  tenantId: z.string().min(1),
  db: DbTargetSchema,
  pipeline: z.array(JsonValue).min(1),
  limit: CoercedLimit, 
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

// drop empty regexes, remove orphan $options, clean empty $or clauses and empty-string leaves
function sanitizeFilter(filter: unknown) {
  if (!filter || typeof filter !== "object") return filter;

  // Remove $options when there is no sibling $regex (handles order-insensitive cases)
  const cleanRegexContainer = (o: Record<string, unknown>) => {
    // If $regex is a blank string, delete it
    if ("$regex" in o) {
      const rv = (o as any)["$regex"];
      if (typeof rv === "string" && rv.trim() === "") {
        delete (o as any)["$regex"];
      }
    }
    // If there’s no $regex at all, $options is meaningless → delete it
    if (!("$regex" in o) && "$options" in o) {
      delete (o as any)["$options"];
    }
  };

  const walk = (obj: Record<string, unknown>) => {
    // Clean current container first so order of keys never matters
    cleanRegexContainer(obj);

    for (const [k, v] of Object.entries(obj)) {
      // Atlas-style $regularExpression: { pattern, options }
      if (k === "$regularExpression" && v && typeof v === "object") {
        const pat = (v as any).pattern;
        if (typeof pat === "string" && pat.trim() === "") {
          delete (obj as any)[k];
          continue;
        }
        walk(v as Record<string, unknown>);
        cleanRegexContainer(v as Record<string, unknown>);
        if (Object.keys(v as Record<string, unknown>).length === 0) {
          delete (obj as any)[k];
        }
        continue;
      }

      // $in: ["", ...] -> remove empty strings; drop $in if empty after cleanup
      if (k === "$in" && Array.isArray(v)) {
        const cleaned = v.filter((x) => !(typeof x === "string" && x.trim() === ""));
        if (cleaned.length) (obj as any).$in = cleaned;
        else delete (obj as any).$in;
        continue;
      }

      // Generic leaf cleanup: drop empty strings (keep 0/false)
      if (typeof v === "string" && v.trim() === "") {
        delete (obj as any)[k];
        continue;
      }

      // Recurse
      if (v && typeof v === "object") {
        walk(v as Record<string, unknown>);
        cleanRegexContainer(v as Record<string, unknown>);

        // If child became empty after cleanup, remove it
        if (Object.keys(v as Record<string, unknown>).length === 0) {
          delete (obj as any)[k];
        }
      }
    }

    // Prune empty $or ([], [{}], objects that ended up empty or only had orphan $options)
    if (Array.isArray((obj as any).$or)) {
      (obj as any).$or = (obj as any).$or
        .map((clause: unknown) => {
          if (clause && typeof clause === "object") {
            walk(clause as Record<string, unknown>);
            cleanRegexContainer(clause as Record<string, unknown>);
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

        // keep a copy for debugging
        const rawFilter = input.filter ?? {};

        // sanitize & guard
        const filter = sanitizeFilter(rawFilter);
        scanForDisallowedKeys(filter);

        // GOOD: structured overview (may still show nested objects as [Object])
        console.log(`[GATEWAY] ${traceId} op=find`, {
          tenantId: input.tenantId,
          coll: input.db.collection,
          limit,
          projection: input.projection,
          sort: input.sort,
        });

        // BETTER: full JSON snapshots so you can verify orphan $options are gone
        console.log(`[GATEWAY] ${traceId} raw_filter`, JSON.stringify(rawFilter));
        console.log(`[GATEWAY] ${traceId} sanitized_filter`, JSON.stringify(filter));

        const coll = db.collection(input.db.collection) as any;
        const cursor = coll.find(filter as any, {
          projection: (input.projection ?? undefined) as any,
          sort:       (input.sort ?? undefined) as any,
        }).limit(limit);

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
