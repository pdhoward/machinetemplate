// /types/prompt.ts
export type ToolUsageEntry = {
  name: string;
  description?: string;
  parameters?: any;
};

export type StructuredPrompt = {
  agent: {
    tenantId: string;
    name?: string;
    tone?: string;
    style_rules?: string[];
    [k: string]: any;
  };
  capabilities?: any;
  policy?: any;
  dialog_flow?: any;
  response_templates?: Record<string, string>;
  examples?: any[];
  [k: string]: any;
};

export type PromptDoc = {
  agent?: {
    tenantId: string;
    name?: string;
  };
  // The whole structured JSON (or even string if you need legacy)
  instructions: StructuredPrompt | string;

  // Allow additional metadata
  [k: string]: any;
};
