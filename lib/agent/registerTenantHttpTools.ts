// lib/agent/registerTenantHttpTools.ts
import type { ToolDef } from "@/types/tools";
import { hydrateHttpTool } from "./httpToolAdapter";

export async function loadAndRegisterTenantHttpTools({
  tenantId,
  registerFunction,
  updateSession,
  coreTools,
  systemPrompt,
  unregisterFunctionsByPrefix,
}: {
  tenantId: string;
  registerFunction: (name: string, fn: (args:any) => Promise<any>) => void;
  updateSession: (p: { tools?: ToolDef[]; instructions?: string }) => void;
  coreTools: ToolDef[];
  systemPrompt: string;
  unregisterFunctionsByPrefix: (prefix: string, keep?: string[]) => number;
}) {
  // 1) fetch descriptors for this tenant
  const res = await fetch(`/api/tool-descriptors/${tenantId}`);
  const descs: any[] = res.ok ? await res.json() : [];

  // 2) preclear old http_ tools
  unregisterFunctionsByPrefix("http_", []);

  // 3) register & build tool schema
  const resolveSecret = (k: string) => process.env[`TENANT_${tenantId.toUpperCase()}_${k.toUpperCase()}`];
  const httpTools: ToolDef[] = [];

  for (const d of descs) {
    if (d.kind !== "http_tool" || !d.enabled) continue;
    const name = d.name.startsWith("http_") ? d.name : `http_${d.name}`;
    const impl = hydrateHttpTool(d, resolveSecret);
    registerFunction(name, impl);
    httpTools.push({
      type: "function",
      name,
      description: d.description ?? name,
      parameters: d.parameters ?? { type: "object", properties: {}, additionalProperties: true }
    });
  }

  // 4) expose to model
  updateSession({ tools: [...coreTools, ...httpTools], instructions: systemPrompt });
  window?.dispatchEvent?.(new CustomEvent("tool-registry-updated"));
}
