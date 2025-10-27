// src/utils/json-revive.ts
import secureParse from "secure-json-parse";

const DEFAULT_MAX_DEPTH = 8;          // avoid deep recursion
const DEFAULT_MAX_STRING = 256_000;   // ~256 KB parsing cap

export function looksJsonish(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const first = t[0], last = t[t.length - 1];
  if ((first === '{' && last === '}') || (first === '[' && last === ']')) return true;
  // quick hints: object-ish or array-ish content
  if (t.includes('":') || t.includes("',") || (t.includes(",") && (t.includes("[") || t.includes("{")))) return true;
  return false;
}

export function isUnrecoverableObjectJoin(s: string): boolean {
  // Once coerced to "[object Object]" the original structure is lost
  return s.includes("[object Object]");
}

/**
 * Recursively revive JSON-like strings into arrays/objects using secure-json-parse.
 * - Skips huge strings and very deep structures (perf safety).
 * - Leaves normal strings alone.
 * - Cannot recover "[object Object]".
 */
export function reviveJsonStringsDeep<T = any>(
  value: T,
  opts?: { maxDepth?: number; maxString?: number },
  _depth = 0,
  _seen = new WeakSet<object>()
): T {
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxString = opts?.maxString ?? DEFAULT_MAX_STRING;

  if (value == null) return value as T;
  if (_depth > maxDepth) return value as T;

  if (typeof value === "string") {
    const s = value;
    if (s.length > maxString || isUnrecoverableObjectJoin(s) || !looksJsonish(s)) {
      return value as T;
    }
    try {
      // secure parse → array/object if valid JSON, else throw
      return secureParse(s) as unknown as T;
    } catch {
      return value as T; // leave it unchanged if not valid JSON
    }
  }

  if (Array.isArray(value)) {
    return value.map((v) => reviveJsonStringsDeep(v, opts, _depth + 1, _seen)) as unknown as T;
  }

  if (typeof value === "object") {
    if (_seen.has(value as object)) return value as T; // cycle guard
    _seen.add(value as object);

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = reviveJsonStringsDeep(v, opts, _depth + 1, _seen);
    }
    return out as unknown as T;
  }

  return value as T;
}
