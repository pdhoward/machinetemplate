// /src/operations/runner.ts
import { loadTools } from "@/lib/loader/tools"; // your existing loader

export async function callNamedOperation(name: string, input: any) {
  const tools = await loadTools();
  const op = tools.find(t => t.name === name);
  if (!op) return { ok: false, error: `Unknown operation ${name}` };
  const parsed = op.schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input", issues: parsed.error.issues };
  const data = await op.handler(parsed.data);
  // Normalize to envelope if needed
  return typeof data === "object" && "ok" in data ? data : { ok: true, data };
}
