// /lib/types/things.schema.ts
import { z } from "zod";

/** Minimal envelope everyone must carry; allow extra fields */
export const ThingBaseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  type: z.string(),                 // "unit" | "spa_treatment" | "policy" | ...
  name: z.string().optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  searchable: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.number().optional(),
}).passthrough();                   // ← keep unknown keys!

export type ThingBase = z.infer<typeof ThingBaseSchema>;

/** Runtime guard to quickly assert an array of Things */
export const ThingArraySchema = z.array(ThingBaseSchema);

/** Query schema (server): accepts optional type/q/limit/searchable */
export const ThingsQuerySchema = z.object({
  type: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  searchable: z.coerce.boolean().optional(),
});
export type ThingsQuery = z.infer<typeof ThingsQuerySchema>;
