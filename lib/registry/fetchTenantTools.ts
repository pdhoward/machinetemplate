import {
  ToolRegistryArraySchema,
  type ToolRegistryItem,
} from "@/types/toolRegistry.schema";

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
  // Validate & coerce with Zod
  return ToolRegistryArraySchema.parse(data);
}

/** Convenience: only http_tool items */
export async function fetchTenantHttpTools(tenantId: string) {
  const items = await fetchTenantRegistryItems(tenantId);
  return items.filter((it) => it.kind === "http_tool");
}
