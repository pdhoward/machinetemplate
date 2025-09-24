import { z } from "zod";

/** Re-usable JSON value type */
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

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const HttpConfigSchema = z.object({
  method: HttpMethodSchema,
  urlTemplate: z.string().min(1, "urlTemplate required"),
  headers: z.record(z.string()).optional(),
  jsonBodyTemplate: JsonValue.optional(),
  okField: z.string().optional(),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
  pruneEmpty: z.boolean().optional()
});

export const HttpToolDescriptorSchema = z.object({
  kind: z.literal("http_tool").default("http_tool"),
  tenantId: z.string().optional(), // useful when stored/fetched
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "use a-z A-Z 0-9 . _ -"),
  description: z.string().optional(),
  parameters: JsonValue
    // allow typical JSON Schema object; you can tighten later if needed
    .default({ type: "object", properties: {}, additionalProperties: true }),
  http: HttpConfigSchema,
  enabled: z.boolean().default(true),
  priority: z.number().int().optional(),
  version: z.number().int().optional(),
});

export const HttpToolDescriptorArraySchema = z.array(HttpToolDescriptorSchema);

export type HttpToolDescriptor = z.infer<typeof HttpToolDescriptorSchema>;
