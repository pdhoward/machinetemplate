
import { z } from "zod";

export const PaymentsCreateIntentInput = z.object({
  tenant_id: z.string(),
  amount_cents: z.number().int().positive(),
  currency: z.string().default("USD"),
  reservation_id: z.string().optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

export type PaymentsCreateIntentInput = z.infer<typeof PaymentsCreateIntentInput>;



export type ToolDef = {
  type: "function";
  name: string;
  description?: string;
  strict?: boolean;
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
  description: "Render a visual panel on the stage.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      component_name: {
        type: "string",
        enum: [          
          "quote_summary",
          "catalog_results",
          "reservation_checkout",
          "room",
          "video",
          "image_viewer",
          "media_gallery"
        ]
      },
      intent: {
        type: "string",
        enum: [,"quote","reservation_checkout","results","room","media","video","image"]
      },
      title: { type: "string" },
      description: { type: "string" },
      size: { type: "string", enum: ["sm","md","lg","xl"] },
      url: { type: "string" },
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
              poster: { type: "string" }
            },
            required: ["kind", "src"]
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
                poster: { type: "string" }
              },
              required: ["kind", "src"]
            }
          }
        ]
      },
      props: { type: "object", additionalProperties: true }
    },
    required: ["component_name"]
  }
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
  /*
    STRIPE TOOLING
  */
  
{
  type: "function",
  name: "payments_create_intent",
  description: "Create a Stripe PaymentIntent and return clientSecret for the payment_form visual.",
  strict: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      tenant_id: { type: "string" },
      amount_cents: { type: "integer", minimum: 1 },
      currency: { type: "string", default: "USD" },
      reservation_id: { type: "string" },
      customer: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" }
        },
        required: []
      }
    },
    required: ["tenant_id", "amount_cents"]
  }
}


];