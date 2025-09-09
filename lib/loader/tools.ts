
import type { ExecutionTool } from "@/types";
import { z } from "zod";
import { executionTools } from "@/operations";

/** Prod cache (kept off in dev for hot reload) */
let cache: ExecutionTool[] | null = null;

function isValidExecutionTool(x: any): x is ExecutionTool {
  try {
    if (!x || typeof x !== "object") return false;
    if (typeof x.name !== "string" || !x.name.trim()) return false;
    if (typeof x.description !== "string" || !x.description.trim()) return false;
    if (!(x.schema instanceof z.ZodObject)) return false;
    if (typeof x.handler !== "function") return false;
    return true;
  } catch {
    return false;
  }
}

/** Load validated tools from the barrel export */
export async function loadTools(): Promise<ExecutionTool[]> {
  if (process.env.NODE_ENV !== "development" && cache) return cache;

  const raw = Array.isArray(executionTools) ? executionTools : [];
  const validated = raw.filter(isValidExecutionTool);

  if (validated.length !== raw.length) {
    const bad = raw.length - validated.length;
    console.warn(`[tools] Skipped ${bad} invalid executionTool(s) from "@/operations".`);
  }

  if (process.env.NODE_ENV !== "development") cache = validated;
  return validated;
}

/** Optional helpers (keep your runner simple) */
export async function getToolByName(name: string) {
  const tools = await loadTools();
  return tools.find(t => t.name === name) || null;
}

export async function callNamedOperation(name: string, input: any) {
  const tool = await getToolByName(name);
  if (!tool) return { ok: false, error: `Unknown operation ${name}` };

  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", issues: parsed.error.issues };
  }

  const data = await tool.handler(parsed.data);
  return typeof data === "object" && data && "ok" in data ? data : { ok: true, data };
}
