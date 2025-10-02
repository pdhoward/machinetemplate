"use client"

import { toast } from "sonner"
import { z } from "zod";

// --- Types used by the stage components ---
const MediaItem = z.object({
  kind: z.enum(["image", "video"]),
  src: z.string().min(1),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  poster: z.string().optional(), // used for video
});
type MediaItem = z.infer<typeof MediaItem>;

const MediaUnion = z.union([MediaItem, z.array(MediaItem)]);

// Core VisualPayload (what VisualStage expects)
const BasePayload = z.object({
  component_name: z
    .enum([
      "payment_form",
      "quote_summary",
      "catalog_results",
      "reservation_confirmation",
      "room",
      "video",
      "image_viewer",
      "media_gallery",
    ])
    .optional(), // may be auto-selected
  title: z.string().optional(),
  description: z.string().optional(),
  size: z.enum(["sm", "md", "lg", "xl"]).optional(),
  url: z.string().optional(),
  props: z.record(z.any()).optional(),
  media: MediaUnion.optional(),
  // optional hint for router (LLM can set this if unsure)
  intent: z
    .enum([
      "payment",
      "quote",
      "reservation_confirmation",
      "results",
      "room",
      "media",
      "video",
      "image",
    ])
    .optional(),
});

// Component-specific minima (light requirements)
const PaymentFormMin = BasePayload.extend({
  component_name: z.literal("payment_form").optional(),
  props: z
    .object({
      intentId: z.string().optional(),
      reservationId: z.string().optional(),
      amountCents: z.union([z.number(), z.string()]).optional(),
      currency: z.string().optional(),
      prefill: z
        .object({
          name: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          address: z
            .object({
              line1: z.string().optional(),
              line2: z.string().optional(),
              city: z.string().optional(),
              region: z.string().optional(),
              postal: z.string().optional(),
              country: z.string().optional(),
            })
            .partial()
            .optional(),
        })
        .partial()
        .optional(),
    })
    .partial()
    .optional(),
});

const QuoteSummaryMin = BasePayload.extend({
  component_name: z.literal("quote_summary").optional(),
  props: z.object({ quote: z.record(z.any()).optional() }).partial().optional(),
});

const ReservationConfirmMin = BasePayload.extend({
  component_name: z.literal("reservation_confirmation").optional(),
  props: z
    .object({
      reservation_id: z.string().optional(),
      unit_id: z.string().optional(),
      check_in: z.string().optional(),
      check_out: z.string().optional(),
    })
    .partial()
    .optional(),
});

const RoomMin = BasePayload.extend({
  component_name: z.literal("room").optional(),
  props: z
    .object({
      tenantId: z.string().optional(),
      unitId: z.string().optional(),
      media: z.array(MediaItem).optional(),
      gallery: z.array(z.string()).optional(),
      title: z.string().optional(),
      subtitle: z.string().optional(),
    })
    .partial()
    .optional(),
});

const VideoMin = BasePayload.extend({
  component_name: z.literal("video").optional(),
  media: MediaUnion.optional(),
});

const ImageViewerMin = BasePayload.extend({
  component_name: z.literal("image_viewer").optional(),
  media: MediaUnion.optional(),
});

const MediaGalleryMin = BasePayload.extend({
  component_name: z.literal("media_gallery").optional(),
  media: z.array(MediaItem).min(1), // gallery should be an array
});

const CatalogResultsMin = BasePayload.extend({
  component_name: z.literal("catalog_results").optional(),
  props: z.object({ items: z.array(z.any()).optional() }).partial().optional(),
});

const AnyVisual = z.union([
  PaymentFormMin,
  QuoteSummaryMin,
  ReservationConfirmMin,
  RoomMin,
  VideoMin,
  ImageViewerMin,
  MediaGalleryMin,
  CatalogResultsMin,
  BasePayload, // last fallback
]);

// --- Helpers ---------------------------------------------------------------
const VIDEO_EXTS = new Set(["mp4", "webm", "m4v", "mov", "ogg"]);
const looksLikeVideo = (src?: string) => {
  if (!src) return false;
  const q = src.split("?")[0];
  const ext = q.split(".").pop()?.toLowerCase();
  return !!ext && VIDEO_EXTS.has(ext);
};

const asArray = <T,>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function tryParseJSON<T = unknown>(v: any): T | any {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {/* ignore */}
  }
  return v;
}

// Normalizes any { url/src } / strings / mixed → VisualMedia[]
function coerceMedia(input: any): MediaItem[] {
  const raw = asArray(tryParseJSON(input));
  const out: MediaItem[] = [];
  for (const i of raw) {
    if (!i) continue;
    const src: string | undefined =
      typeof i === "string" ? i : i.url ?? i.src ?? undefined;
    if (!src) continue;
    if (looksLikeVideo(src)) {
      out.push({ kind: "video", src, poster: i.poster });
    } else {
      out.push({
        kind: "image",
        src,
        alt: i.alt ?? "",
        width: i.width,
        height: i.height,
      });
    }
  }
  return out;
}

// Decide the best component when not explicitly specified
function autoRoute(payload: z.input<typeof BasePayload>): z.output<typeof AnyVisual> {
  const p = { ...payload };

  // bubble media from props if needed and normalize
  const maybeMedia = p.media ?? p.props?.media;
  const media = coerceMedia(maybeMedia);
  if (media.length) {
    p.media = media;
    p.props = { ...(p.props || {}), media };
  }

  // 1) If explicitly provided and known, keep it
  if (p.component_name) return p as any;

  // 2) Intent hints (LLM-friendly)
  switch (p.intent) {
    case "payment":
      return { ...p, component_name: "payment_form" } as any;
    case "quote":
      return { ...p, component_name: "quote_summary" } as any;
    case "reservation_confirmation":
      return { ...p, component_name: "reservation_confirmation" } as any;
    case "room":
      return { ...p, component_name: "room" } as any;
    case "video":
      return { ...p, component_name: "video" } as any;
    case "image":
      return { ...p, component_name: "image_viewer" } as any;
    case "media":
      return { ...p, component_name: "media_gallery" } as any;
    case "results":
      return { ...p, component_name: "catalog_results" } as any;
  }

  // 3) Heuristics
  // Payment-ish
  if (p.props && ("amountCents" in p.props || "currency" in p.props)) {
    return { ...p, component_name: "payment_form" } as any;
  }

  // Reservation confirmation-ish
  if (p.props && ("reservation_id" in p.props || "reservationId" in p.props)) {
    return { ...p, component_name: "reservation_confirmation" } as any;
  }

  // Quote-ish
  if (p.props && "quote" in p.props) {
    return { ...p, component_name: "quote_summary" } as any;
  }

  // Media: choose specific viewer for 1 item, gallery for many
  if (media.length > 1) {
    return { ...p, component_name: "media_gallery", media } as any;
  }
  if (media.length === 1) {
    const m = media[0];
    return { ...p, component_name: m.kind === "video" ? "video" : "image_viewer", media } as any;
  }

  // Room-ish
  if (p.props && ("tenantId" in p.props || "unitId" in p.props)) {
    return { ...p, component_name: "room" } as any;
  }

  // Default listy UI
  return { ...p, component_name: "catalog_results" } as any;}

export const useVisualFunctions = (stageProp: any) => {

  const {stageRef} = stageProp   // ref for the visual component

  const visualFunction = async(args: any) => {
        console.groupCollapsed("[show_component] incoming args");
        console.log(args);
        console.groupEnd();

        // 1) Parse + normalize
        const raw = {
            ...(args || {}),
            // honor stringified media/url/props.media
            media: tryParseJSON(args?.media),
            url: tryParseJSON(args?.url),
            props: {
            ...(tryParseJSON(args?.props) || {}),
            media: tryParseJSON(args?.props?.media),
            url: tryParseJSON(args?.props?.url),
            },
        };

        // 2) Auto-route to the right component if missing
        const routed = autoRoute(raw);

        // 3) Validate against union (gives nice, structured issues if wrong)
        const parsed = AnyVisual.safeParse(routed);
        if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
            }));
            console.warn("[show_component] validation failed", issues);
            return {
            ok: false,
            error: "Invalid visual payload",
            issues,
            expectation:
                "Send `component_name` or set `intent` and include `media` as [{kind:'image'|'video',src,...}] when showing visuals.",
            };
        }

        const payload = parsed.data as any;

        // 4) Mirror top-level → props for components that only read props
        payload.props = { ...(payload.props || {}) };
        if (payload.media && !payload.props.media) payload.props.media = payload.media;
        if (payload.url && !payload.props.url) payload.props.url = payload.url;
        if (payload.title && !payload.props.title) payload.props.title = payload.title;
        if (payload.description && !payload.props.description) payload.props.description = payload.description;

        console.debug("[show_component] normalized + routed payload", {
            component: payload.component_name,
            mediaLen: Array.isArray(payload.media) ? payload.media.length : 0,
            payload,
        });

        stageRef.current?.show(payload);
        return { ok: true, routed_component: payload.component_name };
    } 

  return {
    visualFunction,  
  }
}