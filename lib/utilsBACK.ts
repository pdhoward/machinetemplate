/**
 * Utility helpers used across the voice-agent workflow.
 *
 * WHERE THESE ARE USED IN THE PIPELINE
 * ------------------------------------
 * - The platform stores "HTTP tool" descriptors in Mongo. Those descriptors often include
 *   templated strings (URLs, headers, bodies) with placeholders for runtime values and secrets.
 * - When a tool runs, we build a "context" object (args + secret proxy) and:
 *   - `tpl()` fills a *single string* template (supports both {path} and {{path}} syntaxes).
 *   - `applyTemplate()` walks an *object/array tree* and applies `tpl()` to each string inside.
 * - `cn()` is unrelated to templating; it’s a UI helper to compose Tailwind classes safely.
 *
 * IMPORTANT BEHAVIOR
 * ------------------
 * - `tpl()` replaces *missing* values with the empty string "".
 *   This prevents leaking `{var}` into outbound HTTP, but it can also produce invalid URLs.
 *   Upstream code should validate that no braces remain (or that required keys exist)
 *   *before* calling fetch (the /api/tools/execute route does this).
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn(...classes)
 * --------------
 * Tailwind-safe className combiner.
 *
 * WHY: Tailwind utilities can conflict. `clsx` builds a space-joined string based on truthiness,
 * and `tailwind-merge` resolves conflicts (e.g., `p-2` vs `p-4` → keeps the latter).
 *
 * EXAMPLE:
 *   <div className={cn("p-2", isActive && "p-4", "text-sm")} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * JSONValue
 * ---------
 * A narrow "JSON-like" type for values we intend to template.
 * Using this keeps `applyTemplate` honest: it expects plain serializable data
 * (strings, numbers, booleans, null, objects, arrays)—not Dates, Maps, class instances, etc.
 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JSONValue }
  | JSONValue[];

/** Local alias for a generic dictionary. Intentionally permissive for ctx objects. */
type Dict = Record<string, any>;

/**
 * getByPath(obj, "a.b.c")
 * -----------------------
 * Safely resolves a nested property using dot-notation.
 *
 * WHY: Our templates contain tokens like {tenant_id} or {{secrets.booking_api_key}}.
 *      We need a single resolver that can walk arbitrary paths.
 *
 * BEHAVIOR:
 *  - Returns `undefined` if any segment is missing.
 *  - Works for array indices if they are addressed as dots (e.g., "items.0.id").
 *  - Does not support bracket notation (e.g., "items[0]").
 *
 * EXAMPLE:
 *   getByPath({ a: { b: 1 } }, "a.b")        -> 1
 *   getByPath({ a: [{ id: 9 }] }, "a.0.id")  -> 9
 *   getByPath({}, "x.y")                     -> undefined
 */
function getByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * tpl(input, ctx)
 * ---------------
 * String template expander. Replaces placeholders with values from `ctx`.
 *
 * SUPPORTED SYNTAX:
 *   - Double braces:  {{ path.to.value }}
 *   - Single braces:  { path.to.value }
 *
 * ORDER MATTERS:
 *   We replace double-brace tokens *first*, so that {{...}} doesn’t get eaten
 *   by the single-brace pass.
 *
 * MISSING VALUES:
 *   Missing paths become "" (empty string). This prevents raw `{token}` from leaking
 *   into URLs/headers, but upstream callers should validate that required tokens existed.
 *
 * SECURITY:
 *   `tpl()` only *substitutes* values. It does not sanitize them. When using it
 *   for URLs/headers, ensure inputs are trusted or properly validated upstream.
 *
 * EXAMPLES:
 *   tpl("Hello {name}", { name: "Ada" })                            -> "Hello Ada"
 *   tpl("Bearer {{secrets.apiKey}}", { secrets: { apiKey: "xyz" }}) -> "Bearer xyz"
 *   tpl("https://x/{tenant}/y", { tenant: "cypress" })              -> "https://x/cypress/y"
 */
export function tpl(input: string, ctx: Dict): string {
  if (typeof input !== "string") return input as any;

  // Replace {{ path }} first to avoid the single-brace regex capturing them.
  let out = input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, p1) => {
    const v = getByPath(ctx, String(p1).trim());
    return v == null ? "" : String(v);
  });

  // Then replace { path } tokens.
  out = out.replace(/\{([^}]+?)\}/g, (_m, p1) => {
    const v = getByPath(ctx, String(p1).trim());
    return v == null ? "" : String(v);
  });

  return out;
}

/**
 * applyTemplate(value, ctx)
 * ------------------------
 * Deeply applies `tpl()` to every string within a JSON-like structure,
 * preserving the original shape and (nominal) type.
 *
 * WHEN TO USE:
 *   - Tool descriptors often contain nested objects (headers, body templates, arrays).
 *     This function lets you template the entire structure in one call.
 *
 * WHAT IT DOES:
 *   - Strings are templated via `tpl()`.
 *   - Arrays are mapped element-by-element.
 *   - Plain objects are recursed key-by-key.
 *   - Non-strings (number/boolean/null) are left as-is.
 *
 * WHAT IT DOES NOT DO:
 *   - It does not mutate the original object.
 *   - It does not preserve class instances (expects plain JSON-like data).
 *   - It does not validate required fields—callers must handle that.
 *
 * EXAMPLE:
 *   const ctx = { tenant_id: "cypress", secrets: { token: "abc" } };
 *   applyTemplate(
 *     {
 *       url: "https://api/x/{tenant_id}",
 *       headers: { Authorization: "Bearer {{secrets.token}}" },
 *       body: { unit: "{unit_id}" }
 *     },
 *     ctx
 *   )
 *   // -> {
 *   //      url: "https://api/x/cypress",
 *   //      headers: { Authorization: "Bearer abc" },
 *   //      body: { unit: "" } // if ctx.unit_id is missing, becomes ""
 *   //    }
 */
export function applyTemplate<T = any>(value: T, ctx: Dict): T {
  if (value == null) return value;

  if (typeof value === "string") {
    return tpl(value, ctx) as any;
  }

  if (Array.isArray(value)) {
    return value.map((v) => applyTemplate(v, ctx)) as any;
  }

  if (typeof value === "object") {
    const out: Dict = {};
    for (const [k, v] of Object.entries(value as Dict)) {
      out[k] = applyTemplate(v, ctx);
    }
    return out as T;
  }

  // numbers, booleans, etc. → unchanged
  return value;
}


/**
 * Recursively remove "empty" values from JSON-like data.
 * - Strips: null, undefined, "", [], {} (after pruning their contents)
 * - Keeps: 0, false, non-empty strings/arrays/objects
 *
 * Examples:
 *   pruneEmpty({ a: "", b: null, c: [], d: {}, e: "ok" })
 *   // -> { e: "ok" }
 *
 *   pruneEmpty([ "", [], {}, "x", 0, false ])
 *   // -> ["x", 0, false]
 */
export function pruneEmpty<T = any>(value: T): T {
  // Simple scalars: keep as-is unless explicitly empty string
  if (value === null || value === undefined) return undefined as any;
  if (typeof value === "string") {
    return value.trim() === "" ? (undefined as any) : (value as any);
  }
  if (typeof value !== "object") {
    // numbers, booleans, etc. — keep
    return value;
  }

  // Arrays: prune each element, then drop pruned-empties
  if (Array.isArray(value)) {
    const pruned = (value as any[]).map((v) => pruneEmpty(v)).filter((v) => {
      if (v === undefined || v === null) return false;
      if (typeof v === "string" && v.trim() === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    });
    return pruned as any;
  }

  // Plain objects: prune each property and only keep non-empty ones
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value as Record<string, any>)) {
    const pv = pruneEmpty(v);
    const isEmptyString = typeof pv === "string" && pv.trim() === "";
    const isEmptyArray = Array.isArray(pv) && pv.length === 0;
    const isEmptyObject = pv && typeof pv === "object" && !Array.isArray(pv) && Object.keys(pv).length === 0;

    if (pv !== undefined && pv !== null && !isEmptyString && !isEmptyArray && !isEmptyObject) {
      out[k] = pv;
    }
  }
  return out as any;
}
