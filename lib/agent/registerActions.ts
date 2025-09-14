// lib/agent/registerTenantActions.ts
import type { ToolDef } from "@/types/tools";
import type { ActionDoc } from "@/types/actions";
import {
  missingRequired,
  buildPromptFromMissing,
  humanizeList,
  runEffect,
} from "@/lib/agent/helper";

/**
 * Register tenant-scoped "action.*" tools and expose them to the model.
 * - Fetches actions for a tenant
 * - Optionally caps how many tools to expose (stay under the 128 tool ceiling)
 * - Registers one local handler per action: `action.<actionId>`
 * - Updates the session tools: [coreTools, ...actionTools]
 * - Uses `showOnStage` / `hideStage` callbacks for UI open/close hints
 */
export async function loadAndRegisterTenantActions(opts: {
  tenantId: string;
  coreTools: ToolDef[];
  systemPrompt: string;
  registerFunction: (name: string, fn: (args: any) => Promise<any>) => void;
  updateSession: (p: { tools?: ToolDef[]; instructions?: string }) => void;
  preclear?: {
    /** Remove all tools whose name starts with this prefix (e.g., "action.") */
    prefix: string;
    /** Keep these even if they match the prefix (optional) */
    keep?: string[];
    /** Hook to perform the actual unregister (from context); if omitted, skip preclear */
    unregisterByPrefix?: (prefix: string, keep?: string[]) => number;
  };
  showOnStage?: (args: any) => void;   // e.g., ({ component_name, ...props })
  hideStage?: () => void;              // optional
  maxTools?: number;                   // e.g., 80 to keep headroom under 128
}) {
  const {
    tenantId,
    coreTools,
    systemPrompt,
    registerFunction,
    updateSession,
    preclear,
    showOnStage,
    hideStage,
    maxTools,
  } = opts;

   // --------- A) Preclear "action.*" from client + model tools (optional) ----------
  if (preclear?.unregisterByPrefix && preclear.prefix) {
    const removed = preclear.unregisterByPrefix(preclear.prefix, preclear.keep ?? []);
    if (removed > 0) {
      console.log("[Actions] Precleared", removed, `tool(s) with prefix "${preclear.prefix}"`);
      // Make sure the model tool schema is also reset to core-only before adding new
      updateSession({ tools: [...coreTools], instructions: systemPrompt });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tool-registry-updated", { detail: { op: "preclear", count: removed } }));
      }
    }
  }
  // --------- B) Fetch new actions ----------
  console.log("[Actions] Fetching actions for tenant:", tenantId);
  const res = await fetch(`/api/actions/${tenantId}`, { cache: "no-store" });
  if (!res.ok) {
    console.error("[Actions] Failed to fetch actions:", res.status);
    return;
  }

  const allActions: ActionDoc[] = await res.json();
  console.log("[Actions] Loaded", allActions.length, "action(s):", allActions.map(a => a.actionId));

  // Cap BEFORE registering so the model's tools match what we actually register.
  const actions = typeof maxTools === "number" && maxTools > 0
    ? allActions.slice(0, maxTools)
    : allActions;

  if (actions.length === 0) {
    // Still update session with just core tools and your prompt
    updateSession({ tools: [...coreTools], instructions: systemPrompt });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tool-registry-updated"));
    }
    console.warn("[Actions] No actions to register for tenant:", tenantId);
    return;
  }

  // (C) Register one local handler per action: action.<actionId>
  for (const action of actions) {
    const toolName = `action.${action.actionId}`; // e.g., action.book_stay

    registerFunction(toolName, async (input: any) => {
      const args = input ?? {};

      // 1) Validate against the action's input schema
      const missing = missingRequired(action.inputSchema, args);
      if (missing.length) {
        return {
          ok: false,
          next: { missing, prompt: buildPromptFromMissing(missing) },
          speak: `I’ll need ${humanizeList(missing)}.`,
        };
      }

      try {
        // 2) Execute the action
        const result = await runEffect(action, args);

        // 3) Optional UI instructions
        const ui = result?.ui ?? action.ui;
        if (ui?.open && showOnStage) {
          // Normalize to your stage API: { component_name, ...props }
          showOnStage({
            component_name: ui.open.component,
            ...(ui.open.props ?? {}),
            input: args,
            result,
          });
        }
        if (ui?.close && hideStage) {
          hideStage();
        }

        // 4) Speak line (short, used by voice agent)
        const speak = result?.speak ?? action.speakTemplate ?? "Done.";

        return { ok: true, data: result?.data, ui, speak };
      } catch (err: any) {
        console.error(`[Actions] ${toolName} error:`, err);
        return { ok: false, error: String(err?.message || err) };
      }
    });
  }

  // (D) Build Tool Schemas so the MODEL can call them directly
  const actionTools: ToolDef[] = actions.map((a) => ({
    type: "function",
    name: `action.${a.actionId}`,
    description: a.description ?? a.title ?? a.actionId,
    // Let the model see/use the action's JSON schema
    parameters: a.inputSchema ?? { type: "object", properties: {}, additionalProperties: true },
  }));

  // (E) Expose to the session: core tools + per-action tools
  updateSession({
    tools: [...coreTools, ...actionTools],
    instructions: systemPrompt,
  });

  // Let your /registry UI refresh
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tool-registry-updated"));
  }

  console.log("[Actions] Registered and exposed", actionTools.length, "action tool(s) to model.");
}
