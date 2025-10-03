// export type ToolDef = {
//   type: "function";
//   name: string;
//   description?: string;
//   strict?: boolean;
//   parameters?: any;
// };

 
// --- tool schema you expose to the model ---
export type ToolDef = 
  {
    type: "function",
    name: "show_component",
    description: "Display a modal with images/videos for a unit. Use this after fetching unit data. Pass the full details including media array.",
    parameters: {
      type: "object",
      properties: {
        component_name: { type: "string", description: "Name/slug of the component (e.g., 'falls_villa')" },
        title: { type: "string", description: "Title for the modal (e.g., 'Falls Villa Media')" },
        description: { type: "string", description: "Brief description (e.g., 'Explore photos and videos...')" },
        media: {
          type: "array",
          description: "Array of media objects to display",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["image", "video"] },
              src: { type: "string", description: "URL of the media" },
              alt: { type: "string", description: "Alt text (for images)" },
              poster: { type: "string", description: "Poster image URL (for videos)" }
            },
            required: ["kind", "src"]
          }
        }
      },
      required: ["component_name", "media"], // Enforce media is always passed
      additionalProperties: true // Allow extras if needed
    }
  }


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

  // showComponent 

  {
  type: "function",
  name: "show_component",
  description: "Render a visual panel on the stage.",
  strict: true, // ✅ enforce schema adherence
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      component_name: {
        type: "string",
        enum: [
          "payment_form",
          "quote_summary",
          "catalog_results",
          "reservation_confirmation",
          "room",
          "video",
          "image_viewer",
          "media_gallery",
        ],
      },
      // Optional routing hint the model can set
      intent: {
        type: "string",
        enum: ["payment","quote","reservation_confirmation","results","room","media","video","image"],
      },
      title: { type: "string" },
      description: { type: "string" },
      size: { type: "string", enum: ["sm","md","lg","xl"] },
      url: { type: "string" },
      // NOTE: media can be one item or an array; both branches are strict
      media: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["image", "video"] },
              src: { type: "string" },
              alt: { type: "string" },
              width: { type: "number" },
              height: { type: "number" },
              poster: { type: "string" },
            },
            required: ["kind", "src"],
          },
          {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: ["image", "video"] },
                src: { type: "string" },
                alt: { type: "string" },
                width: { type: "number" },
                height: { type: "number" },
                poster: { type: "string" },
              },
              required: ["kind", "src"],
            },
          },
        ],
      },
      // forward-compatible for your components; keep strict at this level too
      props: {
        type: "object",
        additionalProperties: true
      }
    },
    // Only require the fields you truly need for a minimal render
    required: ["component_name"]
  }
}

];