import { z } from "zod";
import { HttpToolDescriptorSchema } from "./httpTool.schema";

// Extendable discriminated union (start with http_tool)
export const ToolRegistryItemSchema = z.discriminatedUnion("kind", [
  HttpToolDescriptorSchema, // future: add action_tool, browser_tool, etc.
]);

export const ToolRegistryArraySchema = z.array(ToolRegistryItemSchema);

export type ToolRegistryItem = z.infer<typeof ToolRegistryItemSchema>;
