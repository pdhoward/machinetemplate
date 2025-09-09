// /lib/types/actions.ts
export type JSONSchema = Record<string, any>;

export type ActionEffect =
  | { type: "http"; method: "GET"|"POST"|"PATCH"; url: string; headers?: Record<string,string> }
  | { type: "operation"; name: string }; // points to your /src/operations/* executionTool
  // you can add "queue", "workflow", etc.

export type ActionUI =
  | { open: { component: "payment"|"rooms_gallery"|"map"|"video_tour"|"custom"; props?: any } }
  | { close: true }
  | undefined;

export type ActionDoc = {
  _id: string;
  tenantId: string;
  actionId: string;             // e.g., "book_stay"
  title: string;                // human label
  description: string;          // 1-2 lines of intent
  inputSchema: JSONSchema;      // JSON Schema for inputs (drives slots)
  effect: ActionEffect;         // what server should do
  ui?: ActionUI;                // default UI instruction (optional)
  speakTemplate?: string;       // short single-sentence success line
  requiresPayment?: boolean;    // optional guard
  enabled: boolean;
  updatedAt: string;
};
