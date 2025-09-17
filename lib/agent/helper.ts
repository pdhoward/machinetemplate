import type { ActionDoc, ActionEffectPipeline } from "@/types/actions";

/**
 * Run a named op. Keeps the contract tiny and mock-friendly.
 * You can implement these in a separate module and import here.
 */
export type RunStepFn = (op: string, tenantId: string, input: any) => Promise<any>;

export type RunEffectContext = {
  tenantId: string;
  runStep: RunStepFn;
};

export function missingRequired(schema: any, input: any): string[] {
  if (!schema?.required) return [];
  return schema.required.filter((k: string) => input?.[k] == null);
}

export function buildPromptFromMissing(keys: string[]) {
  // keep it short; LLM can rephrase
  if (keys.length === 1) return `What is your ${keys[0].replace(/_/g," ")}?`;
  return `I need ${keys.map(k=>k.replace(/_/g," ")).join(", ")}.`;
}

export function humanizeList(keys: string[]) {
  if (keys.length === 1) return keys[0].replace(/_/g, " ");
  const last = keys[keys.length-1].replace(/_/g, " ");
  return keys.slice(0,-1).map(k=>k.replace(/_/g," ")).join(", ") + " and " + last;
}

/**
 * Executes an ActionDoc according to its effect.
 * Currently supports only `pipeline`.
 *
 * Returns a normalized object with:
 *  - data: aggregated step results (keyed by `op`)
 *  - ui: ui hints (from action or step aggregation)
 *  - speak: optional one-liner for voice agents
 */
export async function runEffect(
  action: ActionDoc,
  input: any,
  ctx: RunEffectContext
): Promise<{ data?: any; ui?: any; speak?: string }> {
  const { tenantId, runStep } = ctx;

  if (!action?.effect) {
    return { data: undefined, ui: action.ui, speak: action.speakTemplate };
  }

  // ---- PIPELINE ONLY ----
  const eff = action.effect as ActionEffectPipeline;
  if (eff.type !== "pipeline") {
    // You said to drop other branches; keep a defensive return.
    return { data: undefined, ui: action.ui, speak: action.speakTemplate };
  }

  const aggregate: Record<string, any> = {};

  // Execute in order. You can enrich `input` from prior results if helpful.
  for (const step of eff.steps) {
    const stepInput = step.args ? { ...input, ...step.args } : input;
    const res = await runStep(step.op, tenantId, stepInput);
    aggregate[step.op] = res;

    // OPTIONAL: infer/propagate fields between steps (example)
    // e.g., copy unit_id from availability/quote into input for later steps
    if (step.op === "getRateQuote") {
      const unitFromQuote = res?.data?.unit_id ?? res?.data?.unit?.id;
      if (unitFromQuote && !input.unit_id) input.unit_id = unitFromQuote;
    }
  }

  return {
    data: aggregate,
    ui: action.ui,
    speak: action.speakTemplate,
  };
}

/** 
 * REALTIME API only accepts tool names matching ^[a-zA-Z0-9_-]+$
 * Make any string safe for OpenAI tool names: replace invalid chars with '_' 
*/
export function safeToolName(base: string): string {
  return String(base).replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Canonical tool name for an action id, e.g. "book.stay" -> "action_book_stay" */
export function actionToolName(actionId: string): string {
  return `action_${safeToolName(actionId)}`;
}

/*

  Used by runEffect via the registerActions to execute the
  pipeline steps of the Action

*/
export async function runStep(op: string, tenantId: string, input: any) {
  switch (op) {
    case "checkAvailability": {
      const params = new URLSearchParams({
        check_in: input.check_in,
        check_out: input.check_out,
      });
      if (input.unit_id) params.set("unit_id", input.unit_id);
      if (input.guests) params.set("guests", String(input.guests));

      const r = await fetch(`/api/booking/${tenantId}/availability?${params}`, { cache: "no-store" });
      return await r.json();
    }

    case "getRateQuote": {
      const params = new URLSearchParams({
        check_in: input.check_in,
        check_out: input.check_out,
        unit_id: input.unit_id,
      });
      const r = await fetch(`/api/booking/${tenantId}/quote?${params}`, { cache: "no-store" });
      return await r.json();
    }

    case "createReservation": {
      const r = await fetch(`/api/booking/${tenantId}/reserve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          check_in: input.check_in,
          check_out: input.check_out,
          unit_id: input.unit_id,
          guest: input.guest,
          payment_token: input.payment_token,
        }),
      });
      return await r.json();
    }

    default:
      return { ok: false, error: `Unknown op: ${op}` };
  }
}


