// lib/agent/registerTenantActions.ts
import type { ToolDef } from "@/types/tools";
import type { ActionDoc } from "@/types/actions";
import { actionToolName } from "@/lib/agent/helper"
import {
  missingRequired,
  buildPromptFromMissing,
  humanizeList,
  runEffect,
  runStep
} from "@/lib/agent/helper";

let inflightByTenant: Record<string, boolean> = {};

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
    prefix: string;
    keep?: string[];
    unregisterByPrefix?: (prefix: string, keep?: string[]) => number;
  };
  showOnStage?: (args: any) => void;
  hideStage?: () => void;
  maxTools?: number;
  skipSessionUpdate?: boolean;
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

  if (inflightByTenant[tenantId]) {
    console.debug("[Actions] Skipping: load already in-flight for tenant", tenantId);
    return;
  }
  inflightByTenant[tenantId] = true;

  try {
    // A) Preclear client-side tools if asked
    if (preclear?.unregisterByPrefix && preclear.prefix) {
      const removed = preclear.unregisterByPrefix(preclear.prefix, preclear.keep ?? []);
      if (removed > 0) {
        console.log("[Actions] Precleared", removed, `tool(s) with prefix "${preclear.prefix}"`);
        // No core-only update here - single update below after we know new actions.
        window?.dispatchEvent?.(new CustomEvent("tool-registry-updated", { detail: { op: "preclear", count: removed } }));
      }
    }

    // B) Fetch new actions
    console.log("[Actions] Fetching actions for tenant:", tenantId);
    const res = await fetch(`/api/actions/${tenantId}`, { cache: "no-store" });
    if (!res.ok) {
      console.error("[Actions] Failed to fetch actions:", res.status);
      // Push at least the core tools so session isn’t empty
      updateSession({ tools: [...coreTools], instructions: systemPrompt });
      return;
    }

    const allActions: ActionDoc[] = await res.json();
    console.log("[Actions] Loaded", allActions.length, "action(s):", allActions.map(a => a.actionId));

    const actions = typeof maxTools === "number" && maxTools > 0
      ? allActions.slice(0, maxTools)
      : allActions;

    // C) Register local handlers
    for (const action of actions) {
      const toolName = actionToolName(action.actionId); // e.g. action_book_stay

      registerFunction(toolName, async (input: any) => {
        const args = input ?? {};
        const missing = missingRequired(action.inputSchema, args);
        if (missing.length) {
          return {
            ok: false,
            next: { missing, prompt: buildPromptFromMissing(missing) },
            speak: `I’ll need ${humanizeList(missing)}.`,
          };
        }

        try {
          const result = await runEffect(action, input ?? {}, { tenantId, runStep });
          const ui = result?.ui ?? action.ui;

          if (ui?.open && showOnStage) {
            showOnStage({
              component_name: ui.open.component,
              ...(ui.open.props ?? {}),
              input: args,
              result,
            });
          }
          if (ui?.close && hideStage) hideStage();

          const speak = result?.speak ?? action.speakTemplate ?? "Done.";
          return { ok: true, ...result };
        } catch (err: any) {
          console.error(`[Actions] ${toolName} error:`, err);
          return { ok: false, error: String(err?.message || err) };
        }
      });
    }

    // D) Build the tool schema once and push a single session update
    const actionTools: ToolDef[] = actions.map((a) => ({
      type: "function",
      name: actionToolName(a.actionId),
      description: a.description ?? a.title ?? a.actionId,
      parameters: a.inputSchema ?? { type: "object", properties: {}, additionalProperties: true },
    }));

    if (!opts.skipSessionUpdate) {
    opts.updateSession({
      tools: [...coreTools, ...actionTools],
      instructions: systemPrompt,
    });
  }

    window?.dispatchEvent?.(new CustomEvent("tool-registry-updated"));
    console.log("[Actions] Registered + exposed", actionTools.length, "action tool(s).");
    return actionTools; // 👈 caller will decide how/when to updateSession
  } finally {
    inflightByTenant[tenantId] = false;
  }
}
