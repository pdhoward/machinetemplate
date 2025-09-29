
import type { ToolDef } from "@/types/tools";
import { applyTemplate } from "@/lib/utils";


type ShowArgsTemplate = {
  component_name: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  props?: any;
  media?: any; // allow templated structures
  url?: string;
};

type UIInstructionTemplate = {
  open?: ShowArgsTemplate;
  close?: boolean;
};

export type HttpDescriptor = {
  kind?: string; // "http_tool"
  name: string;
  description?: string;
  parameters?: any; // JSON Schema for tool args
  enabled?: boolean;
  priority?: number;

  http: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    urlTemplate: string;
    headers?: Record<string, string>;
    jsonBodyTemplate?: any;
    /** If set, we consider the call successful when JSON at this path is truthy (e.g., "ok"). */
    okField?: string;
    timeoutMs?: number;
  };

  /**
   * Optional declarative UI behavior.
   * - onSuccess: evaluated when the HTTP call is considered "ok".
   * - onError: evaluated when "ok" is false.
   * Values inside `open` support templating with { } / {{ }} using ctx: { args, response, status }.
   */
  ui?: {
    onSuccess?: UIInstructionTemplate;
    onError?: UIInstructionTemplate;
  };
};

/** Local helper: safe nested path read */
function getByPath(obj: any, path?: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/** Decide success:
 *  1) If okField provided and response is JSON object → coerce that field to boolean.
 *  2) Otherwise, use HTTP status (2xx).
 */
function computeOk(
  resStatus: number,
  maybeJson: any,
  okField?: string
): boolean {
  if (okField && maybeJson && typeof maybeJson === "object") {
    const v = getByPath(maybeJson, okField);
    return Boolean(v);
  }
  return resStatus >= 200 && resStatus < 300;
}

/** Build a client-side executor that calls our server proxy, then optionally shows/hides UI. */
function buildHttpExecutorViaProxy(
  descr: HttpDescriptor,
  opts?: {
    showOnStage?: (args: any) => void;
    hideStage?: () => void;
  }
) {
  const { showOnStage, hideStage } = opts ?? {};

  return async (args: Record<string, any>) => {
    // Hit the server route so secrets stay server-side.
    const clientTraceId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(`[registerTenantHttpTools - TOOL] ${clientTraceId} call`, { tool: descr.name, args });

    const r = await fetch(`/api/tools/execute`, {
      method: "POST",
      headers: { 
        "content-type": "application/json",
        "x-trace-id": clientTraceId, // correlate with server logs if needed
      },
      body: JSON.stringify({ descriptor: descr, args }),
    });

    const status = r.status;
    const text = await r.text();

    // Try to parse JSON, otherwise treat as text.
    let payload: any = text;
    try {
      payload = JSON.parse(text);
    } catch {
      /* leave as text */
    }

    // Decide success
    const ok = computeOk(status, payload, descr.http.okField);

    // Build a templating context for UI
    const ctx = { args, response: payload, status };

    // 1) Prefer UI instructions returned by the API (response.ui), if present.
    //    Shape: { open?: {...}, close?: true } — same as our template type.
    const responseUi: UIInstructionTemplate | undefined =
      payload && typeof payload === "object" ? (payload.ui as any) : undefined;

    // 2) Otherwise fall back to descriptor-defined UI instructions.
    const fallbackUi =
      ok ? descr.ui?.onSuccess : descr.ui?.onError;

    const ui = responseUi ?? fallbackUi;

    // Execute UI instructions
    if (ui?.open && showOnStage) {
      // Template all strings inside the open payload using ctx (args + response + status)
      const templated = applyTemplate(ui.open, ctx);
      try {
        showOnStage(templated);
      } catch (e) {
        console.warn(
          `[http tool:${descr.name}] showOnStage failed:`,
          (e as any)?.message || e
        );
      }
    }
    if (ui?.close && hideStage) {
      try {
        hideStage();
      } catch (e) {
        console.warn(
          `[http tool:${descr.name}] hideStage failed:`,
          (e as any)?.message || e
        );
      }
    }

    // Return the original tool result to the model (JSON if possible, else text)
    return payload;
  };
}

/** Convert descriptors => ToolDefs + register handlers */
export async function registerHttpToolsForTenant(opts: {
  tenantId: string;
  fetchDescriptors: () => Promise<HttpDescriptor[]>;
  registerFunction: (name: string, fn: (args: any) => Promise<any>) => void;
  cap?: number; // keep under model tool limits (e.g., 128)
  showOnStage?: (args: any) => void;
  hideStage?: () => void;
}) {
  const { fetchDescriptors, registerFunction, cap = 96, showOnStage, hideStage } = opts;
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

    registerFunction(
      safeName,
      buildHttpExecutorViaProxy(d, { showOnStage, hideStage })
    );

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
