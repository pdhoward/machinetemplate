
import { PromptDoc, StructuredPrompt } from "@/types/prompt";
import type { ToolDef } from "@/types/tools";

/** Minimal “tools section” builder for the prompt JSON */
export function makeToolUsageSection(toolDefs: ToolDef[]) {
  return {
    tools: toolDefs.map(t => ({
      name: t.name,
      description: t.description || t.name,
      parameters: t.parameters,
    })),
  };
}

function tryParseJson(s: string | undefined | null): any {
  if (!s || typeof s !== "string") return undefined;
  try { return JSON.parse(s); } catch { return undefined; }
}

/**
 * Accepts mixed prompt docs. Returns:
 *  - name: optional agent name (for display)
 *  - base: the STRUCTURED prompt object (without tools merged yet)
 */
// prompts.ts
export function selectPromptForTenant(
  tenantId: string,
  all: StructuredPrompt | StructuredPrompt[] | unknown
): { name?: string; base: StructuredPrompt } {
  const arr = Array.isArray(all)
    ? (all as StructuredPrompt[])
    : ([all as StructuredPrompt] as StructuredPrompt[]);

  const doc = arr.find(p => p?.agent?.tenantId === tenantId) ?? arr[0];
  if (!doc) throw new Error("No tenant prompt found");

  return { name: doc.agent?.name, base: doc };
}


/** Merge runtime tool schemas into the prompt and stringify for updateSession */
// prompts.ts
export function buildInstructions(base: StructuredPrompt, toolDefs: ToolDef[]): string {
  const toolsSection = {
    tools: toolDefs.map(t => ({
      name: t.name,
      description: t.description ?? t.name,
      parameters: t.parameters ?? { type: "object", properties: {} },
    })),
  };

  const merged = {
    ...base,
    capabilities: {
      ...(base.capabilities ?? {}),
      ...toolsSection,
    },
  };

  return JSON.stringify(merged);
}
