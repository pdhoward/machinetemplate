import { z } from "zod";

export const LINTER_VERSION = "http-linter@1.0.4"; // bump

/** JSON-like value used throughout templating */
export const JsonValue: z.ZodType<
  string | number | boolean | null | { [k: string]: any } | any[]
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValue),
    z.record(JsonValue),
  ])
);

/* ---------------- Visuals (unchanged + meta) ---------------- */

const VisualOpenSchema = z.object({
  /**
   * A registered visual in your stage registry (e.g., "reservation_pending", "room").
   * Used by legacy `open` AND new `emit_show_component`.
   */
  component_name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  size: z.enum(["sm", "md", "lg", "xl"]).optional(),
  /** Arbitrary props (templated allowed) */
  props: JsonValue.optional(),
  /** Optional orchestration hints (ignored by components, used by host) */
  meta: z
    .object({
      replace: z.boolean().optional(),
      debounceMs: z.number().int().positive().optional(),
    })
    .optional(),
});

/* ---------------- Speech emission (new) ---------------- */

const SaySchema = z
  .object({
    /** The phrase to say. Templates OK (e.g., "Your total is {{response.total}}"). */
    text: z.string().min(1),
    /** If true, allow interruption of current TTS (optional). */
    barge: z.boolean().optional(),
    /** If you pass SSML already composed. If present, `text` is ignored. */
    ssml: z.string().optional(),
    /** Optional voice key (if your TTS supports multiple voices). */
    voice: z.string().optional(),
  })
  .strict();

/* ---------------- UI action schema (extended) ---------------- */

const UIActionSchema = z
  .object({   
    /**
     * New: route visuals through `show_component`.
     * Your executor will call your show_component function (or host hook)
     * with this payload AFTER templating (args/response/secrets).
     */
    emit_show_component: VisualOpenSchema.optional(),

    /**
     * New: emit a line of speech immediately (before/after visuals as you choose).
     * Accepts a simple string or a structured object for advanced TTS control.
     */
    emit_say: z.union([z.string().min(1), SaySchema]).optional(),
  })
  .strict();

/* ---------------- HTTP config (unchanged) ---------------- */

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const HttpConfigSchema = z.object({
  method: HttpMethodSchema,
  urlTemplate: z.string().min(1, "urlTemplate required"),
  headers: z.record(z.string()).optional(),
  jsonBodyTemplate: JsonValue.optional(),
  okField: z.string().optional(),
  timeoutMs: z.number().int().positive().max(120_000).default(15_000),
  pruneEmpty: z.boolean().optional(),
});

/* ---------------- Descriptor schema (extended UI) ---------------- */

export const HttpUISchema = z.object({
  loadingMessage: z.string().optional(),
  onSuccess: UIActionSchema.optional(),
  onError: UIActionSchema.optional(),
});

export const HttpToolDescriptorSchema = z.object({
  kind: z.literal("http_tool").default("http_tool"),
  tenantId: z.string().optional(),
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "use a-z A-Z 0-9 . _ -"),
  description: z.string().optional(),
  parameters: JsonValue.default({
    type: "object",
    properties: {},
    additionalProperties: true,
  }),
  http: HttpConfigSchema,
  ui: HttpUISchema.optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().optional(),
  version: z.number().int().optional(),
});

export const HttpToolDescriptorArraySchema = z.array(HttpToolDescriptorSchema);
export type HttpToolDescriptor = z.infer<typeof HttpToolDescriptorSchema>;
