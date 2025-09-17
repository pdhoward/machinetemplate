// types/actions.ts

/** Keep JSON Schema flexible; you can swap to JSONSchema7 later */
export type JsonSchema = Record<string, any>;

export type ActionUISpec = {
  open?: {
    component: string;
    /** Arbitrary props your stage understands */
    props?: Record<string, any>;
  };
  close?: boolean;
};

export type ActionPipelineStep = {
  /** Logical op name the effect runner understands (e.g., "checkAvailability") */
  op: string;
  /** Optional per-step args/overrides passed to the op runner */
  args?: Record<string, any>;
};

/** The only supported effect now: a pipeline of steps */
export type ActionEffectPipeline = {
  type: "pipeline";
  steps: ActionPipelineStep[];
};

export type ActionEffect = ActionEffectPipeline;

export type ActionDoc = {
  /** Stable doc id */
  id: string;
  /** Tenant scoping */
  tenantId: string;
  /** The action tool id used by the model (e.g., "book_stay") */
  actionId: string;

  /** Human labels */
  title?: string;
  description?: string;

  /** JSON Schema for input validation (what the tool exposes to the model) */
  inputSchema: JsonSchema;

  /** How to execute (pipeline only) */
  effect: ActionEffect;

  /** Optional UI hints (stage open/close) */
  ui?: ActionUISpec;

  /** Optional assistant speech template */
  speakTemplate?: string;

  /** Commercial flags */
  requiresPayment?: boolean;
  enabled?: boolean;

  /** Timestamps */
  createdAt?: string;  // ISO
  updatedAt?: string;  // ISO
};
