"use client";

import { z } from "zod";
import type { VisualStageHandle } from "@/components/visual-stage-host"; 

/* =========================================================================
   Visuals Hook — hardened
   - Single Zod schema with per-component refines
   - Deterministic autoRoute() that always sets component_name
   - Fail-soft fallback for media_gallery so UX never stalls
   ======================================================================= */

// ----------------------------- Helpers -----------------------------------

const VIDEO_EXTS = new Set(["mp4", "webm", "m4v", "mov", "ogg"]);

function looksLikeVideo(src?: string) {
  if (!src) return false;
  const q = src.split("?")[0];
  const ext = q.split(".").pop()?.toLowerCase();
  return !!ext && VIDEO_EXTS.has(ext);
}

const asArray = <T,>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function tryParseJSON<T = unknown>(v: any): T | any {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      /* ignore */
    }
  }
  return v;
}

function isAbsoluteHttpsUrl(url?: string) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

// ------------------------- Schema (single) --------------------------------

const ImageItem = z
  .object({
    kind: z.literal("image"),
    src: z.string().url(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  })
  .strict();

const VideoItem = z
  .object({
    kind: z.literal("video"),
    src: z.string().url(),
    poster: z.string().url().optional(),
    // allow alt on video as a caption/label if you use it in UI
    alt: z.string().optional(),
  })
  .strict();

const VisualMediaItem = z.discriminatedUnion("kind", [ImageItem, VideoItem]);
type TMediaItem = z.infer<typeof VisualMediaItem>;

export const VisualPayloadSchema = z
  .object({
    component_name: z.enum([      
      "quote_summary",
      "catalog_results",
      "reservation_checkout",
      "room",
      "video",
      "image_viewer",
      "media_gallery",
    ]),
    title: z.string().optional(),
    description: z.string().optional(),
    size: z.enum(["sm", "md", "lg", "xl"]).optional(),
    url: z.string().url().optional(),
    props: z.record(z.any()).optional(),
    media: z.array(VisualMediaItem).optional(),
  })
  .strict()
  // Per-component rules (small, predictable constraints):
  .refine(
    (p) =>
      p.component_name !== "media_gallery" ||
      (Array.isArray(p.media) && p.media.length > 0),
    {
      message: "media_gallery requires media[] with at least one item",
      path: ["media"],
    }
  )
  .refine(
    (p) =>
      p.component_name !== "video" ||
      (Array.isArray(p.media) &&
        p.media.length === 1 &&
        p.media[0]?.kind === "video"),
    {
      message: "video requires exactly one video item in media[]",
      path: ["media"],
    }
  )
  .refine(
    (p) =>
      p.component_name !== "image_viewer" ||
      (Array.isArray(p.media) &&
        p.media.length === 1 &&
        p.media[0]?.kind === "image"),
    {
      message: "image_viewer requires exactly one image item in media[]",
      path: ["media"],
    }
  );

// ----------------------- Normalization helpers ----------------------------

// Normalizes any { url/src } / strings / mixed → VisualMediaItem[]
function coerceMedia(input: any): TMediaItem[] {
  const raw = asArray(tryParseJSON(input));
  const out: TMediaItem[] = [];
  for (const i of raw) {
    if (!i) continue;
    const src: string | undefined =
      typeof i === "string" ? i : i.url ?? i.src ?? undefined;
    if (!src) continue;

    // Keep absolute HTTPS only — prevents surprises at render
    if (!isAbsoluteHttpsUrl(src)) continue;

    if (looksLikeVideo(src)) {
      out.push({ kind: "video", src, poster: i.poster, alt: i.alt ?? "" });
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
function autoRoute(input: any) {
  const p: any = { ...input };

  // normalize media
  const media = coerceMedia(p.media ?? p.props?.media);
  if (media.length) {
    p.media = media;
    p.props = { ...(p.props || {}), media };
  }

    // 2) ⬇️ intent hints (only if component_name is missing)
  if (!p.component_name && typeof p.intent === "string") {
    const map: Record<string, string> = {     
      quote: "quote_summary",
      reservation_checkout: "reservation_checkout",
      room: "room",
      media: "media_gallery",
      video: "video",
      image: "image_viewer",
      results: "catalog_results",
    } as const;
    const mapped = map[p.intent];
    if (mapped) p.component_name = mapped as any;
  }

   // 🔑 3) Strip intent before validation (prevents Zod unrecognized_keys)
  if ("intent" in p) delete p.intent;

  // Always guarantee a component_name
  if (!p.component_name) {
    if (media.length > 1) p.component_name = "media_gallery";
    else if (media.length === 1)
      p.component_name = media[0].kind === "video" ? "video" : "image_viewer";
    else p.component_name = "catalog_results";
  }

  return p;
}

// ------------------------------- Hook -------------------------------------

type Props = { stageRef: React.RefObject<VisualStageHandle | null> };

export const useVisualFunctions = ({ stageRef }: Props) => {

  const visualFunction = async (args: any) => {
    console.groupCollapsed("[show_component] incoming args");
    console.log(args);
    console.groupEnd();

    // 1) Parse + normalize stringified fields
    const raw = {
      ...(args || {}),
      media: tryParseJSON(args?.media),
      url: tryParseJSON(args?.url),
      props: {
        ...(tryParseJSON(args?.props) || {}),
        media: tryParseJSON(args?.props?.media),
        url: tryParseJSON(args?.props?.url),
      },
    };

    // 2) Auto-route to the right component and guarantee component_name
    const routed = autoRoute(raw);
    console.log("[show_component] routed", routed);

    // 3) Validate against the single schema
    const parsed = VisualPayloadSchema.safeParse(routed);
    if (!parsed.success) {
      console.error("[show_component] zod error", parsed.error);

      // --- Fail-soft fallback: if it's obviously renderable as a gallery, show it ---
      const media = Array.isArray(routed?.media) ? routed.media : [];
      const looksRenderable =
        routed?.component_name === "media_gallery" &&
        media.length > 0 &&
        media.every(
          (m: any) =>
            m?.src &&
            typeof m.src === "string" &&
            m.src.startsWith("https://") &&
            (m.kind === "image" || m.kind === "video")
        );

      if (looksRenderable) {
        const fallback = {
          ...routed,
          component_name: "media_gallery",
          props: { ...(routed.props || {}), media },
        };
        console.warn(
          "[show_component] using safe fallback render for media_gallery"
        );
        stageRef.current?.show(fallback);
        return {
          ok: true,
          routed_component: "media_gallery",
          warning: "zod_failed_fallback_rendered",
        };
      }

      // Hard error path (feeds the agent a precise fix)
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return {
        ok: false,
        error: "schema_violation",
        why: "Your tool arguments didn’t match the schema.",
        fix: {
          summary: "Recall show_component with a valid VisualPayload.",
          minimal_example: {
            component_name: "media_gallery",
            media: [
              {
                kind: "image",
                src: "https://res.cloudinary.com/stratmachine/image/upload/v1759170503/cypress/outdoorshower_pt4q3n.jpg",
              },
            ],
          },
          must: [
            "Populate media[].src with working, absolute HTTPS URLs.",
            "Derive media from the Unit document’s images array.",
            "If you don't have the Unit, first call compose_media_payload(tenantId, unitId) or fetch /api/booking/{tenantId}/rooms?active=true and use the matching unit.",
            "Do NOT use placeholders like 'https://...'.",
          ],
        },
        issues,
      };
    }

    const payload = parsed.data as any;

    // 4) Mirror top-level → props for components that only read props
    payload.props = { ...(payload.props || {}) };
    if (payload.media && !payload.props.media) payload.props.media = payload.media;
    if (payload.url && !payload.props.url) payload.props.url = payload.url;
    if (payload.title && !payload.props.title) payload.props.title = payload.title;
    if (payload.description && !payload.props.description)
      payload.props.description = payload.description;

    console.log("[show_component] normalized + routed payload", {
      component: payload.component_name,
      mediaLen: Array.isArray(payload.media) ? payload.media.length : 0,
      payload,
    });

     // before calling show(), add a hard guard for clarity
    const target = stageRef?.current;
    if (!target || typeof target.show !== "function") {
      console.error("[show_component] stage not ready", {
        hasRef: !!stageRef,
        hasCurrent: !!stageRef?.current,
      });
      return { ok: false, error: "stage_not_ready" };
    }

    target.show(payload);
    return { ok: true, routed_component: payload.component_name };
    
  };

  return {
    visualFunction,
  };
};
