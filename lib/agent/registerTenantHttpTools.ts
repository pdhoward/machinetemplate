// src/lib/agent/registerHttpTools.ts
import type { ToolDef } from "@/types/tools";

type HttpDescriptor = {
  kind?: string; // "http_tool"
  name: string;
  description?: string;
  parameters?: any; // JSON Schema for the tool args
  enabled?: boolean;
  priority?: number;
  http: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    urlTemplate: string;
    headers?: Record<string, string>;
    jsonBodyTemplate?: any;
    okField?: string;
    timeoutMs?: number;
  };
};

/** Create a client-side handler that proxies to a server route for secrets & fetch. */
function buildHttpExecutorViaProxy(descr: HttpDescriptor) {
  return async (args: Record<string, any>) => {
    const r = await fetch(`/api/tools/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ descriptor: descr, args }),
    });
    // return JSON or text; leave as-is for the model caller
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };
}

/** Convert descriptors => ToolDefs + register handlers */
export async function registerHttpToolsForTenant(opts: {
  tenantId: string;
  fetchDescriptors: () => Promise<HttpDescriptor[]>;
  registerFunction: (name: string, fn: (args: any) => Promise<any>) => void;
  cap?: number; // keep under model tool limits (e.g. 128)
}) {
  const { fetchDescriptors, registerFunction, cap = 96 } = opts;
  const all = (await fetchDescriptors()).filter((d) => d.enabled !== false);

  // sort by priority desc, name asc (stable)
  all.sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name)
  );

  const limited = all.slice(0, cap);

  // Register handlers + build ToolDefs
  const toolDefs: ToolDef[] = [];
  for (const d of limited) {
    // ✅ Ensure name collision safety and a stable prefix
    const safeName = d.name.startsWith("http_") ? d.name : `http_${d.name}`;

    registerFunction(safeName, buildHttpExecutorViaProxy(d));

    toolDefs.push({
      type: "function",
      name: safeName, // ✅ expose the safe name
      description: d.description ?? d.name,
      parameters: d.parameters ?? {
        type: "object",
        properties: {},
        additionalProperties: true,
      },
    });
  }

  return toolDefs;
}
