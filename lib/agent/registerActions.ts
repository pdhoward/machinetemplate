// lib/agent/registerTenantActions.ts
import type { RefObject } from "react";
import type { ToolDef } from "@/types/tools";
import type { ActionDoc } from "@/types/actions";
import { missingRequired, buildPromptFromMissing, humanizeList, runEffect } from "@/lib/agent/helper";


type StageLike = { show?: (args:any) => void; hide?: () => void };
// match your VisualStageHandle surface
type StageHandle = { show?: (args: any) => void; hide?: () => void };
// Accept either a real RefObject or any { current?: ... } holder, and allow null/undefined
type StageRefLike =
  | React.RefObject<StageLike | null | undefined>
  | { current?: StageLike | null | undefined };

export async function loadAndRegisterTenantActions(opts: {
  tenantId: string;
  coreTools: ToolDef[];
  systemPrompt: string;
  registerFunction: (name: string, fn: (args: any) => Promise<any>) => void;
  updateSession: (p: { tools?: ToolDef[]; instructions?: string }) => void;
 stageRef?: StageRefLike;     // ✅ widened
  // optional: limit how many action tools you expose at once
  maxTools?: number; // defaults to unlimited; set to e.g. 80 if you want headroom under 128
}) {
  const {
    tenantId,
    coreTools,
    systemPrompt,
    registerFunction,
    updateSession,
    stageRef,
    maxTools,
  } = opts;

  console.log("[Actions] Fetching actions for tenant:", tenantId);
  const res = await fetch(`/api/actions/${tenantId}`, { cache: "no-store" });
  if (!res.ok) {
    console.error("[Actions] Failed to fetch actions:", res.status);
    return;
  }

  const actions: ActionDoc[] = await res.json();
  console.log("[Actions] Loaded", actions.length, "action(s):", actions.map(a => a.actionId));

  // (A) Register one local handler per action: action.<actionId>
  for (const action of actions) {
    const toolName = `action.${action.actionId}`; // e.g., action.book_stay

    // register concrete tool
    registerFunction(toolName, async (input: any) => {
      const args = input ?? {};

      // Validate against the action's input schema
      const missing = missingRequired(action.inputSchema, args);
      if (missing.length) {
        return {
          ok: false,
          next: { missing, prompt: buildPromptFromMissing(missing) },
          speak: `I’ll need ${humanizeList(missing)}.`,
        };
      }

      try {
        const result = await runEffect(action, args);

        // Optional UI open/close
        const ui = result?.ui ?? action.ui;
        if (ui?.open && stageRef?.current?.show) {
          stageRef.current.show({
            component_name: ui.open.component,
            ...(ui.open.props ?? {}),
            input: args,
            result,
          });
        }
        if (ui?.close && stageRef?.current?.hide) {
          stageRef.current.hide();
        }

        const speak = result?.speak ?? action.speakTemplate ?? "Done.";
        return { ok: true, data: result?.data, ui, speak };
      } catch (err: any) {
        console.error(`[Actions] ${toolName} error:`, err);
        return { ok: false, error: String(err?.message || err) };
      }
    });
  }

  // (B) Build per-action ToolDefs so the MODEL can call them directly
  let actionTools: ToolDef[] = actions.map((a) => ({
    type: "function",
    name: `action.${a.actionId}`,
    description: a.description ?? a.title ?? a.actionId,
    parameters: a.inputSchema ?? { type: "object", properties: {}, additionalProperties: true },
  }));

  // Optional safety headroom under the 128 tool ceiling
  if (typeof maxTools === "number" && maxTools > 0) {
    actionTools = actionTools.slice(0, maxTools);
  }

  // (C) Expose to the session: core tools + per-action tools
  updateSession({
    tools: [...coreTools, ...actionTools],
    instructions: systemPrompt,
  });

  // Notify your /registry UI
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tool-registry-updated"));
  }

  console.log("[Actions] Exposed", actionTools.length, "action tool(s) to model.");
}
