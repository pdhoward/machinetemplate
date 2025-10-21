import { z } from "zod";

export const LINTER_VERSION = "http-linter@1.0.3";

/** JSON-like value used throughout templating */
export const JsonValue: z.ZodType<
  string | number | boolean | null | { [k: string]: any } | any[]
> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(JsonValue)])
);

/* ---------------- UI schema (new) ---------------- */

const VisualOpenSchema = z.object({
  /**
   * The registered visual to open in your stage registry (e.g., "payment_form", "room", etc.)
   */
  component_name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  size: z.enum(["sm", "md", "lg", "xl"]).optional(),
  /**
   * Arbitrary props passed to the visual component.
   * These values may contain template tokens like {{args.foo}} or {{response.bar}}.
   */
  props: JsonValue.optional(),
});

/**
 * Declarative UI instructions applied after the HTTP call:
 *  - onSuccess: applied when okField is present (or HTTP 2xx if okField missing)
 *  - onError: applied otherwise
 *  - loadingMessage: transient toast while the tool runs (optional)
 */
export const HttpUISchema = z.object({
  loadingMessage: z.string().optional(),
  onSuccess: z
    .object({
      open: VisualOpenSchema.optional(),
      close: z.boolean().optional(),
    })
    .optional(),
  onError: z
    .object({
      open: VisualOpenSchema.optional(),
      close: z.boolean().optional(),
    })
    .optional(),
});

/* ---------------- HTTP schema (yours, with tiny nits) ---------------- */

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const HttpConfigSchema = z.object({
  method: HttpMethodSchema,
  urlTemplate: z.string().min(1, "urlTemplate required"),
  headers: z.record(z.string()).optional(),          // string templates allowed
  jsonBodyTemplate: JsonValue.optional(),            // object/array/string templates
  /**
   * If set, success = response has a *truthy* property at this key/path.
   * If omitted, success = HTTP 2xx.
   *
   * Keep it simple: most people use a top-level key like "ok" or "clientSecret".
   */
  okField: z.string().optional(),
  timeoutMs: z.number().int().positive().max(120_000).default(15_000),
  pruneEmpty: z.boolean().optional(),
});

/* ---------------- Descriptor schema (yours + UI) ---------------- */

export const HttpToolDescriptorSchema = z.object({
  kind: z.literal("http_tool").default("http_tool"),
  tenantId: z.string().optional(), // optional for storage/indexing
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "use a-z A-Z 0-9 . _ -"),
  description: z.string().optional(),
  /**
   * Developer-supplied "parameters" object (usually JSON Schema-ish).
   * We keep it permissive so the model sees the shape it should call with.
   */
  parameters: JsonValue.default({ type: "object", properties: {}, additionalProperties: true }),
  http: HttpConfigSchema,
  /**
   * Declarative UI instructions. Optional; when omitted nothing is opened/closed by default.
   * Your executor already supports a "response.ui" override—this schema only covers the static descriptor side.
   */
  ui: HttpUISchema.optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().optional(),
  version: z.number().int().optional(),
});

export const HttpToolDescriptorArraySchema = z.array(HttpToolDescriptorSchema);
export type HttpToolDescriptor = z.infer<typeof HttpToolDescriptorSchema>;
