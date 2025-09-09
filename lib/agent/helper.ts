import { ActionDoc } from "@/types/actions";

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

export async function runEffect(action: ActionDoc, input: any) {
  if (action.effect.type === "http") {
    const { method, url, headers } = action.effect;
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json", ...(headers||{}) },
      body: method === "GET" ? undefined : JSON.stringify({ input }),
      cache: "no-store",
    });
    const data = await res.json().catch(()=> ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data; // should be { ok, data?, ui?, speak? }
  }

  if (action.effect.type === "operation") {
    // reuse your /src/operations loader
    const { callNamedOperation } = await import("@/operations/runner"); // simple wrapper you have
    return callNamedOperation(action.effect.name, input); // return { ok, data?, ui?, speak? }
  }

  return { ok: false, error: "Unknown effect type" };
}
