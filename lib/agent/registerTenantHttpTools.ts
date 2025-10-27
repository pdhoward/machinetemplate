
import type { ToolDef } from "@/types/tools";
import { applyTemplate, hasUnresolvedTokens } from "@/lib/utils";
import { reviveJsonStringsDeep } from "@/lib/datacheck/json-revive";
import { toast } from "sonner";
import type { HttpToolDescriptor, UIAction } from "@/types/httpTool.schema";


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
  descr: HttpToolDescriptor,
  opts?: {
    showOnStage?: (args: any) => void;
    hideStage?: () => void;
  }
) {
  const { showOnStage, hideStage } = opts ?? {};

  return async (args: Record<string, any>) => {
    // Hit the server route so secrets stay server-side.
    const clientTraceId = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const toastId = `tool_${clientTraceId}`;
    let outcomeShown = false

    // client-side timeout (respects descr.http.timeoutMs if present)
    const controller = new AbortController();
    const timeoutMs = (descr.http as any)?.timeoutMs && Number((descr.http as any).timeoutMs);
    const timeout =
      Number.isFinite(timeoutMs) && timeoutMs! > 0
        ? setTimeout(() => controller.abort(), timeoutMs!)
        : undefined;

    const loadingText = (descr as any).ui?.loadingMessage || `Running ${descr.name}…`;
    toast.loading(loadingText, { id: toastId });

    let status = 0;
    let payload: any = null;
    let ok = false;

    try {
      console.log(`[registerTenantHttpTools - TOOL] ${clientTraceId} call`, { tool: descr.name, args });

      const r = await fetch(`/api/tools/execute`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trace-id": clientTraceId, // correlate with server logs if needed
        },
        body: JSON.stringify({ descriptor: descr, args }),
        signal: controller.signal,
      });

      status = r.status;
      const text = await r.text();

      // Try to parse JSON, otherwise treat as text.
      payload = text;
      try {
        payload = JSON.parse(text);
      } catch {
        /* leave as text */
      }

      // Decide success
      ok = computeOk(status, payload, descr.http.okField);

      // Build a templating context for UI
        const ctx = { args, response: payload, status };

        // Prefer UI instructions from the API; fallback to descriptor-defined
        const responseUi: UIAction | undefined =
          payload && typeof payload === "object" ? (payload.ui as any) : undefined;

        const fallbackUi = ok ? descr.ui?.onSuccess : descr.ui?.onError;
        const ui = responseUi ?? fallbackUi;

        // Execute UI instructions (revive JSON-like strings before showing)
        if (ui?.emit_show_component && showOnStage) {
          let openPayload = applyTemplate(ui.emit_show_component, ctx);

          // ⬇️ First gate revive: convert any JSON-looking strings into objects/arrays
          openPayload = reviveJsonStringsDeep(openPayload);

          if (hasUnresolvedTokens(openPayload)) {
            console.warn(`[http tool UI:${descr.name}] unresolved tokens in UI payload`, openPayload);
          } else {
            try {
              showOnStage(openPayload);
            } catch (e) {
              console.warn(`[http tool:${descr.name}] showOnStage failed:`, (e as any)?.message || e);
            }
          }
        }

     
     // Toast outcome
      if (ok) {
        const successMsg =
          (payload && typeof payload === "object" && (payload.message || payload.msg)) ||
          `${descr.name} completed`;
        toast.success(successMsg, { id: toastId, duration: 1500 }); // 👈 keep visible ~1.5s
        outcomeShown = true;
      } else {
        const errorMsg =
          (payload && typeof payload === "object" && (payload.error || payload.message)) ||
          `HTTP ${status} from ${descr.name}`;
        toast.error(errorMsg, { id: toastId, duration: 3000 }); // error usually a bit longer
        outcomeShown = true;
      }

      // Return original tool result to the model (JSON if possible, else text)
      return payload;
    } catch (err: any) {
      // AbortError or network failure
      const aborted = err?.name === "AbortError";
      const msg = aborted
        ? `${descr.name} timed out`
        : `Error running ${descr.name}: ${err?.message || String(err)}`;

      // keep UI consistent on fatal error
      try { hideStage?.(); } catch {}

      toast.error(msg, { id: toastId, duration: 3000 });
      outcomeShown = true;

      return { ok: false, error: msg, status, };

    } finally {
      
       if (!outcomeShown) {
        toast.dismiss(toastId);
       }
    }
  };
}

/** Convert descriptors => ToolDefs + register handlers */
export async function registerHttpToolsForTenant(opts: {
  tenantId: string;
  fetchDescriptors: () => Promise<HttpToolDescriptor[]>;
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
