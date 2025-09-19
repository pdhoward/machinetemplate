export type StructuredPrompt = Record<string, any>;

export type PromptDoc = {
  agent: {
    tenantId: string;
    name?: string;
    instructions?: StructuredPrompt | string;
  };
};

/**
 * Returns the *string* system prompt for a tenant.
 * If the stored instructions are an object, JSON.stringify it.
 * Falls back to the first prompt in the file if no match.
 */
export function selectPromptForTenant(
  tenantId: string,
  all: PromptDoc[]
): { name?: string; instructions: string } {
  const doc =
    all.find((p) => p.agent?.tenantId === tenantId) ??
    all[0];

  const instr = doc?.agent?.instructions;
  const instructions =
    typeof instr === "string" ? instr : JSON.stringify(instr);

  return { name: doc?.agent?.name, instructions };
}
