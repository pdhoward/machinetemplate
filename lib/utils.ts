import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// src/lib/utils/template.ts

// A narrow JSON type that's friendly to TS inference for templating
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JSONValue }
  | JSONValue[];

/** Replace {{ path.to.value }} inside strings using ctx object. */
export function tpl(str: string, ctx: Record<string, any>): string {
  return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
    const parts = String(path).split(".");
    let cur: any = ctx;
    for (const p of parts) cur = cur?.[p];
    return cur == null ? "" : String(cur);
  });
}

/**
 * Recursively apply `tpl` to any string fields within a JSON-like object.
 * Preserves the original shape and returns the same type.
 */
export function applyTemplate<T extends JSONValue>(
  obj: T,
  ctx: Record<string, any>
): T {
  if (obj == null) return obj;

  if (typeof obj === "string") {
    // As T is a string here, cast back to T
    return tpl(obj, ctx) as T;
  }

  if (Array.isArray(obj)) {
    // Map element-wise and cast back to T (which is JSONValue[])
    return obj.map((v) => applyTemplate(v as JSONValue, ctx)) as T;
  }

  if (typeof obj === "object") {
    const out: Record<string, JSONValue> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = applyTemplate(v as JSONValue, ctx);
    }
    // Cast back to T which must be a JSON object shape here
    return out as T;
  }

  // numbers/booleans/null are returned as-is
  return obj;
}

