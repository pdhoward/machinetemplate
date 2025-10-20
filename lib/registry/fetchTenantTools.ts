import {
  ToolRegistryArraySchema,
  type ToolRegistryItem,
} from "@/types/toolRegistry.schema";
import { lintHttpToolDescriptors } from "@/lib/validator/lint-tools"; 
import type { HttpToolDescriptor } from "@/types/httpTool.schema";

/**
 * Fetch enabled registry items for a tenant via your Next.js API.
 * Validates the payload with Zod and returns strongly-typed items.
 */
export async function fetchTenantRegistryItems(
  tenantId: string
): Promise<ToolRegistryItem[]> {
  const res = await fetch(`/api/tools/fetch/${encodeURIComponent(tenantId)}`, {
    // keep it cache-busting; these can change often
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch registry items (${res.status}): ${text || "Unknown error"}`
    );
  }

  const data = await res.json();
  
  // Lint BEFORE registering
  const results = lintHttpToolDescriptors(data); // returns structured issues 
  const hasErrors = results.some(r => r.issues.some(i => i.severity === "error"));

  // Surface problems in logs; choose whether to hard-fail or just warn
  if (hasErrors) {
    console.error("[tools] Lint errors:", results);
    throw new Error("Tool descriptors failed lint");
    // Option B (soft): continue but DO NOT send tools with errors
    // rows = rows.filter(r => !results.find(x => x.name === r.name)?.issues.some(i => i.severity === "error"));
  } else {
    console.log("[tools] Lint OK for", tenantId);
  }

  
  // Validate & coerce with Zod
  return ToolRegistryArraySchema.parse(data);
}

/** Convenience: only http_tool items */
export async function fetchTenantHttpTools(tenantId: string) {
  const items = await fetchTenantRegistryItems(tenantId);
  return items.filter((it) => it.kind === "http_tool");
}
