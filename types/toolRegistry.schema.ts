import { z } from "zod";
import { HttpToolDescriptorSchema } from "./httpTool.schema";

// Extendable discriminated union 
export const ToolRegistryItemSchema = z.discriminatedUnion("kind", [
  HttpToolDescriptorSchema, 
]);

export const ToolRegistryArraySchema = z.array(ToolRegistryItemSchema);

export type ToolRegistryItem = z.infer<typeof ToolRegistryItemSchema>;
