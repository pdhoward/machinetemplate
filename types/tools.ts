export type ToolDef = {
  type: "function";
  name: string;
  description?: string;
  parameters?: any;
};

// visual surface

export const coreTools: ToolDef[] = [ 
   // --------------------------------------------------------------------------
  // Visuals
  // --------------------------------------------------------------------------
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
   // --------------------------------------------------------------------------
  // Local utility tools (mapped via nameMap in your App)
  // --------------------------------------------------------------------------

  // timeFunction -> "getCurrentTime"
  {
    type: "function",
    name: "getCurrentTime",
    description:
      'Returns the current local time and timezone. Example prompt: "What time is it right now?"',
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // backgroundFunction -> "changeBackgroundColor"
  {
    type: "function",
    name: "changeBackgroundColor",
    description:
      'Toggles between light and dark themes for the UI. Example: "Switch to dark mode" or "Change background."',
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // partyFunction -> "partyMode"
  {
    type: "function",
    name: "partyMode",
    description:
      'Triggers a short confetti + color animation for celebration. Example: "Start party mode!".',
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  // launchWebsite -> "launchWebsite"
  {
    type: "function",
    name: "launchWebsite",
    description:
      'Opens a website in a new browser tab. Example: "Take me to https://example.com".',
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute URL to open (must start with http/https).",
          pattern: "^(https?:)\\/\\/",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },

  // copyToClipboard -> "copyToClipboard"
  {
    type: "function",
    name: "copyToClipboard",
    description:
      'Copies text to the user’s clipboard. Example: "Copy this confirmation code."',
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Plain text to copy.", minLength: 1 },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },

  // scrapeWebsite -> "scrapeWebsite"
  {
    type: "function",
    name: "scrapeWebsite",
    description:
      'Fetches and returns website content for analysis/summarization. Examples: "fetch example.com/blog and summarize the articles." or "fetch the site strategicmachines.ai and tell me about their products" or "scrape the site data.gov and tell me whats new".',
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Publicly reachable absolute URL (http/https) to scrape.",
          pattern: "^(https?:)\\/\\/",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },


];