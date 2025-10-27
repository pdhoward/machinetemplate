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


// --- token regex ---
const TOKEN_RE_DBL = /\{\{\s*([^}]+?)\s*\}\}/g;
const TOKEN_RE_SNG = /\{([^}]+?)\}/g;

// Infer required args from JSON-Schema-ish descriptor.parameters
export function inferRequiredArgs(descriptor: any): Set<string> {
  const req = new Set<string>();
  const params: any = descriptor?.parameters || {};
  if (params && typeof params === "object" && Array.isArray(params.required)) {
    for (const k of params.required) if (typeof k === "string") req.add(k);
  }
  return req;
}

// Request-time validation: only allow args.* and secrets.*
// - args.* are required only if listed in parameters.required
// - secrets.* are required if referenced
const ALLOWED_REQUEST_ROOTS = new Set(["args", "secrets"]);
export function findMissingRequestTokens(
  value: any,
  ctx: Record<string, any>,
  requiredArgs: Set<string>
): string[] {
  const missing: string[] = [];
  const tokens = collectTokens(value);
  for (const raw of tokens) {
    const tok = stripFilters(raw);          // e.g. "args.limit"
    const root = tok.split(".")[0]!;        // "args"
    if (!ALLOWED_REQUEST_ROOTS.has(root)) {
      missing.push(`${tok} (invalid root)`);      // e.g. "response.*" in request-time
      continue;
    }

    if (root === "args") {
      const head = tok.split(".")[1];             // "limit"
      const isRequired = head ? requiredArgs.has(head) : false;
      const v = getByPath(ctx, tok);
      if (isRequired && v === undefined) missing.push(tok);
      continue; // optional args may resolve to undefined → OK
    }

    if (root === "secrets") {
      const v = getByPath(ctx, tok);
      if (v === undefined || v === "") missing.push(tok);
    }
  }
  return [...new Set(missing)];
}

// Optional: remove ?k= from URLs where value === ""
export function stripEmptyQueryParams(u: string): string {
  try {
    const url = new URL(u);
    [...url.searchParams.keys()].forEach((k) => {
      if (url.searchParams.get(k) === "") url.searchParams.delete(k);
    });
    return url.toString();
  } catch { return u; }
}


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
export function getByPath(obj: any, path: string) {
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
/**
 * Filters registry used by `tpl()` pipe syntax.
 * Usage examples in templates:
 *   {{ args.amount_cents | number }}
 *   {{ args.currency | default('USD') | upper }}
 *   {{ args.prefill | json }}
 */
const FILTERS: Record<string, (val: any, arg?: any) => any> = {
  number: (v) => {
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  },
  int: (v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : v;
  },
  bool: (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true") return true;
      if (s === "false") return false;
      if (s === "1") return true;
      if (s === "0") return false;
    }
    return !!v;
  },
  upper: (v) => (v == null ? v : String(v).toUpperCase()),
  lower: (v) => (v == null ? v : String(v).toLowerCase()),
  trim:  (v) => (v == null ? v : String(v).trim()),
  default: (v, dflt) => (v == null || v === "" ? dflt : v),
  json: (v) => {
    // If already an object/array, keep it. If valid JSON string, parse; otherwise leave as-is.
    if (v && (typeof v === "object" || Array.isArray(v))) return v;
    if (typeof v === "string") {
      try { const parsed = JSON.parse(v); return parsed; } catch { /* ignore */ }
    }
    return v;
  },
};

/** Parse a filter token like "default('USD')" or "default:USD" or "default" → {name, arg} */
function parseFilterToken(tok: string): { name: string; arg?: any } {
  const t = tok.trim();
  // Try paren form: name('arg') / name("arg")
  const m = /^([a-zA-Z_][\w-]*)\s*\(\s*(['"]?)(.*?)\2\s*\)\s*$/.exec(t);
  if (m) return { name: m[1], arg: m[3] };

  // Try colon form: name:arg
  const c = /^([a-zA-Z_][\w-]*)\s*:\s*(.+)$/.exec(t);
  if (c) return { name: c[1], arg: c[2].trim() };

  return { name: t };
}

/** Resolve a {{ path | filter1 | filter2('x') }} expression against ctx. */
function resolveExpr(expr: string, ctx: Record<string, any>): any {
  const parts = expr.split("|").map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return "";

  // First part is a dot-path (e.g., args.tenant_id or response.clientSecret)
  const basePath = parts[0];
  let val = getByPath(ctx, basePath);

  // Apply filters in order
  for (let i = 1; i < parts.length; i++) {
    const { name, arg } = parseFilterToken(parts[i]);
    const fn = FILTERS[name];
    if (typeof fn === "function") {
      val = fn(val, arg);
    }
  }
  return val;
}

/**
 * tpl(input, ctx)
 * ---------------
 * Supports pipe filters: {{ path | number }}, {{ path | json }}, {{ path | default('USD') | upper }}
 * Also still supports single-brace {path} form (no filters there by design).
 */
// Make tpl return `any` (not string)
export function tpl(input: string, ctx: Record<string, any>): any {
  if (typeof input !== "string") return input as any;

  const isWholeDouble = /^\s*\{\{\s*[^{}]+\s*\}\}\s*$/.test(input);
  const isWholeSingle = /^\s*\{\s*[^{}]+\s*\}\s*$/.test(input);

  if (isWholeDouble) {
    // strip {{ }}
    const expr = input.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, "");
    // resolve with filters and return RAW value
    return resolveExpr(expr, ctx);
  }

  if (isWholeSingle) {
    // strip { }
    const path = input.replace(/^\s*\{\s*|\s*\}\s*$/g, "");
    // return RAW value
    return getByPath(ctx, path);
  }

  // Mixed-content template → do legacy replace and coerce to string
  let out = input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
    const v = resolveExpr(String(expr).trim(), ctx);
    return v == null ? "" : String(v);
  });

  out = out.replace(/\{([^}]+?)\}/g, (_m, p1) => {
    const v = getByPath(ctx, String(p1).trim());
    return v == null ? "" : String(v);
  });

  return out;
}


/** True if any unresolved {{...}} remain in a JSON-like structure */
export function hasUnresolvedTokens(value: any): boolean {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? "");
  // Only detect mustache tokens; do not test for single-brace pattern that collides with JSON
  return /\{\{\s*[^{}]+\s*\}\}/.test(s); 
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

/**
 * Extract tokens from a string with NO duplicates and NO brace leakage.
 * - First collect all {{ ... }}.
 * - Then remove them from the string.
 * - Then collect single-brace { ... } from the remainder.
 */
export function extractTokensFromString(s: string): string[] {
  if (typeof s !== "string") return [];
  const tokens: string[] = [];

  // 1) collect double-brace
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE_DBL.exec(s))) tokens.push(m[1].trim());

  // 2) strip ALL double-brace spans so singles won't “see” the first '{' of a double
  const withoutDbl = s.replace(/\{\{\s*[^{}]+?\s*\}\}/g, "");

  // 3) collect single-brace from the stripped string
  while ((m = TOKEN_RE_SNG.exec(withoutDbl))) tokens.push(m[1].trim());

  return tokens;
}


// Normalize "args.limit | number" -> "args.limit"
export function stripFilters(token: string): string {
  return token.split("|")[0]!.trim();
}

/**
 * Recursively collect tokens from objects/arrays/strings.
 * ALWAYS returns *bare* paths (e.g. "args.tenant_id"), filters removed.
 */
export function collectTokens(value: any, out: string[] = []): string[] {
  if (value == null) return out;
  if (typeof value === "string") {
    const tks = extractTokensFromString(value);
    for (const t of tks) out.push(stripFilters(t));
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectTokens(v, out);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) collectTokens(v, out);
  }
  return out;
}

// Validate that all tokens resolve in ctx (for request-time objects: URL, headers, body)
// We only allow these roots at request time:
const ALLOWED_ROOTS = new Set(["args", "secrets"]);

export function findMissingTokens(
  value: any,
  ctx: Record<string, any>
): string[] {
  const missing: string[] = [];
  const tokens = collectTokens(value); // ← already filter-stripped, brace-free

  for (const tok of tokens) {
    const root = tok.split(".")[0]!;
    if (!ALLOWED_ROOTS.has(root)) {
      missing.push(`${tok} (invalid root)`); // e.g. response.* inside request
      continue;
    }
    const v = getByPath(ctx, tok);
    if (v === undefined) missing.push(tok);
  }
  return [...new Set(missing)];
}
// --- end helpers ---

