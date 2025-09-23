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
