import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { CoreMessage, streamText, tool } from "ai";
import type { TranscriptItem, ExecutionTool } from "@/lib/types";

/**
 * getReservations — Supervisor tool (single public entry point)
 *
 * The LLM receives one tool (this one). Inside, we provide several
 * *internal* tools (listUnits, checkAvailability, createBooking, cancelBooking,
 * getBookingsForUser, getBookingById) that call your live Next.js API routes.
 *
 * Keep this file as the sole exported ExecutionTool for “Reservations”
 * so your MetaAgent does NOT need changes: it still calls just `getReservations`.
 *
 * ENV expected (for server-to-server calls):
 * - NEXT_PUBLIC_BASE_URL (preferred)  e.g. https://your-app.vercel.app
 * - or VERCEL_URL                     e.g. your-app.vercel.app
 * - else fallback: http://localhost:3000 (dev)
 */

// ---------------------------
// Helpers
// ---------------------------
function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// Normalize/validate YYYY-MM-DD (UTC day)
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD");

// ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:mm minimal) for service requests
const isoDateish = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
  .describe("Date or DateTime (YYYY-MM-DD or YYYY-MM-DDTHH:mm)");

async function api<T>(
  path: string,
  init?: RequestInit & { parse?: "json" | "text" }
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;

  // Extract and remove our custom "parse" + any incoming headers from init
  const { parse, headers: incoming, ...rest } = init ?? {};

  // Build a Headers object and safely set custom headers
  const headers = new Headers(incoming as HeadersInit | undefined);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (process.env.PUBLIC_API_KEY) {
    headers.set("x-api-key", process.env.PUBLIC_API_KEY as string);
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers,
    ...rest, // strictly RequestInit 
  });

  const isJson = (parse ?? "json") === "json";
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const msg = (isJson && (data as any)?.error) || `HTTP ${res.status} when calling ${path}`;
    throw new Error(String(msg));
  }
  return data as T;
}

// A light unit shape used in responses back to the LLM
const UnitBrief = z.object({
  _id: z.string(),
  name: z.string(),
  unitNumber: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  rate: z.number().optional(),
  currency: z.string().optional(),
});

// ---------------------------
// External-facing (public) schema for this ExecutionTool
// ---------------------------
export const GetReservationsSchema = z.object({
  relevantContextFromLastUserMessage: z
    .string()
    .describe("Key information from the user's most recent message"),
  transcriptLogs: z.array(z.any()).optional().describe("Conversation history"),
});

// ---------------------------
// Internal “callable tools” schemas (used by the LLM inside streamText)
// ---------------------------

const ListUnitsSchema = z.object({
  onlyActive: z.boolean().optional().default(true),
});

const CheckAvailabilitySchema = z.object({
  unitId: z.string().describe("The target unit _id"),
  startYmd: ymd.describe("Check-in (YYYY-MM-DD)"),
  endYmd: ymd.optional().describe("Check-out inclusive (YYYY-MM-DD). Defaults to startYmd"),
});

// ---- richer booking payload the agent can gather

const GuestSchema = z.object({
  firstName: z.string().min(1).describe("Guest first name"),
  lastName: z.string().min(1).describe("Guest last name"),
  email: z.string().email().describe("Guest email (for confirmation)"),
  phone: z.string().min(7).describe("Guest mobile number"),
  postalCode: z.string().optional().describe("Billing ZIP/postal code"),
});

const SpecialOccasionSchema = z.object({
  kind: z.enum([
    "anniversary",
    "birthday",
    "honeymoon",
    "proposal",
    "babymoon",
    "graduation",
    "other",
  ]),
  date: ymd.optional(),
  notes: z.string().optional(),
});

const ChefRequestSchema = z.object({
  requestedAt: isoDateish.optional().describe("Preferred date/time"),
  partySize: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const SpaRequestSchema = z.object({
  requestedAt: isoDateish.optional().describe("Preferred date/time"),
  treatment: z.string().optional(),
  notes: z.string().optional(),
});

const ServicesSchema = z.object({
  chef: ChefRequestSchema.optional(),
  spa: SpaRequestSchema.optional(),
});

// ⚠️ Payment: do NOT pass raw PAN/CVV to the LLM or general APIs.
// Require a PSP token (preferred) OR, at minimum, last4 + brand for confirmation language.
const PaymentSchema = z
  .object({
    method: z.enum(["token"]).default("token"),
    paymentMethodToken: z
      .string()
      .min(1)
      .describe("PSP payment method token (Stripe pm_xxx, Braintree nonce, etc.)"),
    last4: z.string().regex(/^\d{4}$/).optional(),
    brand: z.string().optional(),
  })
  .describe("PCI-safe payment payload (tokenized).");

export const CreateBookingSchema = z.object({
  unitId: z.string(),
  startYmd: ymd.describe("Check-in (YYYY-MM-DD)"),
  endYmd: ymd.describe("Check-out inclusive (YYYY-MM-DD)"),

  // Guest & extras
  guest: GuestSchema.describe("Guest identity & contact"),
  occasions: z.array(SpecialOccasionSchema).optional(),
  services: ServicesSchema.optional(),
  marketingOptIn: z.boolean().optional(),

  // PCI-safe payment
  payment: PaymentSchema,
});

const CancelBookingSchema = z.object({
  reservationId: z.string(),
});

const GetBookingByIdSchema = z.object({
  reservationId: z.string(),
});

const GetBookingsForUserSchema = z.object({
  email: z.string().email(),
});

// ---------------------------
// Utility: make “unit label” for voice-friendly responses
// ---------------------------
function unitLabel(u: z.infer<typeof UnitBrief>) {
  return `${u.name}${u.unitNumber ? ` #${u.unitNumber}` : ""}`;
}

// ---------------------------
// Transcript filtering (unchanged behavior, just tidied)
// ---------------------------
function filterTranscriptLogs(transcriptLogs: TranscriptItem[]): any[] {
  let breadcrumbCount = 0;
  const filtered: any[] = [];
  for (const item of transcriptLogs) {
    if (item.type === "BREADCRUMB" && breadcrumbCount < 2) {
      breadcrumbCount++;
      continue;
    }
    if (item.type === "MESSAGE") {
      const { guardrailResult, expanded, ...rest } = item as any;
      filtered.push(rest);
    } else {
      filtered.push(item);
    }
  }
  return filtered;
}

// ---------------------------
// Supervisor Prompt
// ---------------------------
const supervisorAgentInstructions = `
You are the **Reservations supervisor agent** for a luxury resort. Use the tools to complete bookings with warmth, savvy and efficiency.

Your job: handle booking-related requests by using the available tools below. 
Speak naturally (short, friendly sentences), and **ask for any missing details** you need (e.g., dates, unit preference, name/email).

## Tools you can call (internal)
- **listUnits**: Get the list of units (name, number, rate).
- **checkAvailability**: Given a unit and dates, check availability against the live calendar & reservations.
- **createBooking**: Create a reservation after availability and key infomration is collected and confirmed.
- **cancelBooking**: Cancel a reservation by its ID.
- **getBookingById**: Retrieve a specific booking.
- **getBookingsForUser**: Retrieve a user's bookings by email (if available in API).

## Guidance
- If asked "what's available", call **listUnits** then **checkAvailability** for one or two good matches. Ask the guest which they prefer.
- If dates are known but unit is not, present 1–3 succinct options with rate; avoid long lists.
- Always confirm dates clearly (YYYY-MM-DD). For conversation, the end date is **checkout** (inclusive).
- Before **createBooking**, always **checkAvailability**. If unavailable, propose nearby dates or alternate units.
- For **createBooking** you must gather **guest** details (first/last, email, phone) and **payment**:
  - Do **not** collect full card numbers by voice. Say you'll send a **secure payment link** and confirm last-4 + brand after it’s completed.
  - Proceed only once a **paymentMethodToken** is available; bookings cannot be held without payment.
- Be anticipatory: ask gently about **special occasions**, and whether they'd like **chef** or **spa** services. Capture preferences (date/time, party size, treatment, notes).
- If the guest is in a rush: collect dates, unit, name, email, phone, and payment token now, and let them know we’ll follow up by email about occasions and services.
- For **cancelBooking**, confirm the reservation ID and proceed.
- Keep responses short, polished, savvy and human — this is a high-end experience.
`;

// ---------------------------
// Main handler the MetaAgent calls (single exposed tool)
// ---------------------------
export async function getReservationsResponse(
  { relevantContextFromLastUserMessage }: { relevantContextFromLastUserMessage: string },
  transcriptLogs: TranscriptItem[] | undefined,
  addTranscriptBreadcrumb?: (message: string, data?: any) => void
) {
  if (!relevantContextFromLastUserMessage) {
    return { error: "Missing relevant context from last user message" };
  }

  const filteredLogs = filterTranscriptLogs(transcriptLogs || []);

  const messages: CoreMessage[] = [
    { role: "system", content: supervisorAgentInstructions },
    {
      role: "user",
      content: `==== Conversation History ====
${JSON.stringify(filteredLogs, null, 2)}

==== Most Recent User Context ===
${relevantContextFromLastUserMessage}
`,
    },
  ];

  try {
    const result = await streamText({
      model: openai("gpt-4o"),
      messages,
      maxSteps: 8,
      tools: {
        listUnits: tool({
          description: "List rentable units (rooms/villas).",
          parameters: ListUnitsSchema,
          execute: async ({ onlyActive }) => {
            addTranscriptBreadcrumb?.("[reservations] listUnits called", { onlyActive });
            // Adjust query param as your API expects.
           const units = await api<any[]>(`/api/public/units${onlyActive ? "?active=1" : ""}`, { method: "GET" });

            // Normalize a bit for voice use
            const normalized = (units || []).map((u: any) =>
              UnitBrief.parse({
                _id: String(u._id),
                name: String(u.name || ""),
                unitNumber: u.unitNumber ? String(u.unitNumber) : undefined,
                type: u.type ? String(u.type) : undefined,
                description: u.description ? String(u.description) : undefined,
                rate: typeof u.rate === "number" ? u.rate : Number(u.rate || 0),
                currency: u.currency ? String(u.currency) : "USD",
              })
            );

            addTranscriptBreadcrumb?.("[reservations] listUnits result", normalized);
            return { units: normalized };
          },
        }),

        checkAvailability: tool({
          description:
            "Check live availability for a specific unit and date range.",
          parameters: CheckAvailabilitySchema,
          execute: async ({ unitId, startYmd, endYmd }) => {
            const payload = {
              unitId,
              startYmd,
              endYmd: endYmd || startYmd,
            };
            addTranscriptBreadcrumb?.(
              "[reservations] checkAvailability called",
              payload
            );

            // Your existing route performs calendar rules + overlaps
            const data = await api<{
              ok: boolean;
              reasons?: string[];
              quote?: {
                nightlyRate?: number;
                currency?: string;
                nights?: number;
                total?: number;
              };
              calendar?: { name: string; version: number };
            }>("/api/public/availability", {
              method: "POST",
              body: JSON.stringify(payload),
            });

            addTranscriptBreadcrumb?.(
              "[reservations] checkAvailability result",
              data
            );
            return data;
          },
        }),

        createBooking: tool({
            description:
              "Create a reservation after availability is confirmed and required details are collected (end date is inclusive in conversation).",
            parameters: CreateBookingSchema,
            execute: async ({
              unitId,
              startYmd,
              endYmd,
              guest,
              occasions,
              services,
              marketingOptIn,
              payment,
            }) => {
              // Convert inclusive end → EXCLUSIVE (+1 day) for API
              const endExclusive = new Date(`${endYmd}T00:00:00Z`);
              endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
              const endYmdExclusive = endExclusive.toISOString().slice(0, 10);

              const payload = {
                unitId,
                startYmd,
                endYmd: endYmdExclusive, // API expects EXCLUSIVE
                guest,                   // { firstName, lastName, email, phone, postalCode? }
                occasions,               // optional[]
                services,                // optional { chef?, spa? }
                marketingOptIn,          // optional
                payment,                 // { method:"token", paymentMethodToken, last4?, brand? }
              };

              addTranscriptBreadcrumb?.("[reservations] createBooking called", {
                ...payload,
                payment: { ...payment, paymentMethodToken: "***" }, // redact token in logs
              });

              // POST to your public route
              const saved = await api<{
                _id: string;
                startDate: string; // ISO
                endDate: string;   // ISO (exclusive)
                status?: string;
              }>("/api/public/reservations", {
                method: "POST",
                body: JSON.stringify(payload),
              });

              addTranscriptBreadcrumb?.("[reservations] createBooking result", {
                ...saved,
                endDate: undefined,
              });

              // Return voice-friendly summary
              return {
                reservationId: saved._id,
                startYmd,
                endYmd,
                status: saved.status ?? "confirmed",
              };
            },
          }),

        cancelBooking: tool({
          description: "Cancel an existing reservation by id.",
          parameters: CancelBookingSchema,
          execute: async ({ reservationId }) => {
            addTranscriptBreadcrumb?.("[reservations] cancelBooking called", {
              reservationId,
            });
            const updated = await api<any>(`/api/reservations/${reservationId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "cancelled" }),
            });
            addTranscriptBreadcrumb?.(
              "[reservations] cancelBooking result",
              updated
            );
            return { reservationId, status: "cancelled" };
          },
        }),

        getBookingById: tool({
          description: "Retrieve details of a specific reservation by id.",
          parameters: GetBookingByIdSchema,
          execute: async ({ reservationId }) => {
            addTranscriptBreadcrumb?.("[reservations] getBookingById called", {
              reservationId,
            });
            const doc = await api<any>(`/api/reservations/${reservationId}`, {
              method: "GET",
            });
            addTranscriptBreadcrumb?.(
              "[reservations] getBookingById result",
              doc
            );
            return doc;
          },
        }),

        getBookingsForUser: tool({
          description:
            "Retrieve all reservations for a user by email (if supported by API).",
          parameters: GetBookingsForUserSchema,
          execute: async ({ email }) => {
            addTranscriptBreadcrumb?.(
              "[reservations] getBookingsForUser called",
              { email }
            );
            // If not implemented on your side, return an informative error.
            try {
              const docs = await api<any[]>(
                `/api/reservations?email=${encodeURIComponent(email)}`,
                { method: "GET" }
              );
              addTranscriptBreadcrumb?.(
                "[reservations] getBookingsForUser result",
                docs
              );
              return { bookings: docs || [] };
            } catch (err: any) {
              addTranscriptBreadcrumb?.(
                "[reservations] getBookingsForUser not implemented",
                { message: err?.message }
              );
              return {
                error:
                  "Lookup by email is not available yet. Please provide a reservation ID.",
              };
            }
          },
        }),
      },

      onStepFinish: (step) => {
        addTranscriptBreadcrumb?.("[reservations] step finished", step);
      },
    });

    // Stream out the final response (natural language)
    let fullResponse = "";
    for await (const delta of result.textStream) {
      fullResponse += delta;
    }
    if (!fullResponse) {
      return { error: "No content in response" };
    }
    return { nextResponse: fullResponse };
  } catch (error) {
    console.error("getReservationsResponse error:", error);
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}

// ---------------------------
// Exposed ExecutionTool
// ---------------------------
export const executionTool: ExecutionTool = {
  name: "getReservations",
  description: "Reservations supervisor agent (Cypress Resorts).",
  schema: GetReservationsSchema,
  handler: async (params: z.infer<typeof GetReservationsSchema>) => {
    const { relevantContextFromLastUserMessage, transcriptLogs } = params;
    return getReservationsResponse(
      { relevantContextFromLastUserMessage },
      transcriptLogs,
      // Optional breadcrumb hook (not used when invoked via /api/execute-tool):
      undefined
    );
  },
};
