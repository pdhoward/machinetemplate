import { z } from 'zod';

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  tokens?: number
  type: string
  response?: {
    usage: {
      total_tokens: number
      input_tokens: number
      output_tokens: number
    }
  }
} 

export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

// used in lib/loader/tools.ts
export interface ExecutionTool {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  handler: (params: any) => Promise<any>;
  agentId?: string;
}