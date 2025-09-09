export type ToolDef = {
  type: "function";
  name: string;
  description: string;
  parameters?: any;
};

// visual surface

export const coreTools: ToolDef[] = [ 
  {
    type: "function",
    name: "show_component",
    description: "Display a UI component (image/video/panel) by name.",
    parameters: {
      type: "object",
      properties: {
        component_name: { type: "string", description: "Component key to display" },
        title:          { type: "string" },
        description:    { type: "string" },
        props:          { type: "object" },
        media:          { type: "object" },
        url:            { type: "string" }
      },
      required: ["component_name"],
      additionalProperties: true,
    },
  },

  // data-driven action executor
  {
    type: "function",
    name: "execute_action",
    description: "Execute a high-level business action by id.",
    parameters: {
      type: "object",
      properties: {
        action_id: { type: "string", description: "Action identifier (e.g., 'book_stay')" },
        input:     { type: "object", description: "Payload for this action" },
      },
      required: ["action_id"],
      additionalProperties: false,
    },
  },

  // reader for catalog-like items
  {
    type: "function",
    name: "list_things",
    description: "Browse available 'things' (units, spa_treatment, media...).",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Optional filter (e.g., 'unit')" },
      },
      additionalProperties: false,
    },
  },

  // optional fallback: let the model call your server supervisor
  {
    type: "function",
    name: "getReservations",
    description: "Reservations supervisor agent (fallback).",
    parameters: {
      type: "object",
      properties: {
        relevantContextFromLastUserMessage: {
          type: "string",
          description: "Key info from the user’s most recent message"
        },
      },
      required: ["relevantContextFromLastUserMessage"],
      additionalProperties: false,
    },
  },
];