"use client";

import React from "react";
import { ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getVisualComponent } from "@/components/visual-registry";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type VisualMedia =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number; blurDataURL?: string }
  | { kind: "video"; src: string; poster?: string };

export type VisualPayload = {
  component_name: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  props?: Record<string, any>;
  media?: VisualMedia | VisualMedia[];
  url?: string;
};

type Props = { open: boolean; onOpenChange: (v: boolean) => void; payload: VisualPayload | null };

const sizeToWidth: Record<NonNullable<VisualPayload["size"]>, string> = {
  sm: "w-[380px]",
  md: "w-[560px]",
  lg: "w-[840px]",
  xl: "w-[1120px]",
};

// Components that already render their own heading/subtitle “chrome”
const HAS_OWN_CHROME = new Set([
  "payment_form",
  "quote_summary",
  "catalog_results",
  "reservation_confirmation",
  "room",
  "media_gallery",
]);

export default function VisualStage({ open, onOpenChange, payload }: Props) {
  const size = payload?.size ?? "md";

  // Compute title/description with sensible fallbacks
  const rawTitle = payload?.title ?? prettyTitle(payload?.component_name ?? "Preview");
  const titleText = rawTitle?.trim() || "Media viewer";
  const description = payload?.description?.trim() || "";

  const VisualComp = payload?.component_name ? getVisualComponent(payload.component_name) : null;

  // Pass media through and add "compact" so children can tighten layout
  const visualProps = {
    compact: true,
    ...(payload?.props ?? {}),
    media: payload?.media ?? payload?.props?.media,
  };

  // Hide outer header if the inner component already renders its own
  const showHeader = payload?.component_name ? !HAS_OWN_CHROME.has(payload.component_name) : true;

  // a11y ids — Content will always reference a title id
  const titleId = "visual-stage-title";
  const descId = "visual-stage-desc";

  if (process.env.NODE_ENV !== "production") {
    console.debug("[VisualStage] payload", payload);
    console.debug("[VisualStage] visualProps (to component)", visualProps);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={[
          // compact, no extra inner borders, responsive, height-limited
          "bg-neutral-900 text-neutral-200 border border-neutral-800 p-0 overflow-hidden",
          "w-[92vw]",
          sizeToWidth[size],
           "h-[min(65vh,650px)]",             // compact cap; lets inner gallery manage its fit
          "grid grid-rows-[auto,1fr,auto]", // header / content / footer
        ].join(" ")}         
      >
        {/* ✅ Baseline a11y: ALWAYS mount a DialogTitle as the FIRST child */}
        <VisuallyHidden>
          <DialogTitle>{titleText}</DialogTitle>
        </VisuallyHidden>

        {/* Header (hidden for components with their own chrome) */}
        {showHeader ? (
          <DialogHeader className="px-4 pt-3 pb-2 border-b border-neutral-800">             
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* Visible DialogTitle */}
                <DialogTitle id={titleId} className="text-sm font-medium truncate">
                  {titleText}
                </DialogTitle>
                {description ? (
                  <DialogDescription id={descId} className="mt-1 text-xs text-neutral-400 line-clamp-2">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
              <DialogClose className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400">
                <X size={16} />
              </DialogClose>
            </div>
          </DialogHeader>
        ) : (
          // When hidden, use sr-only directly on the title and description for clean hiding
          <div className="relative">
            <DialogTitle className="sr-only" id={titleId}>
              {titleText}
            </DialogTitle>
            {description ? (
              <DialogDescription className="sr-only" id={descId}>
                {description}
              </DialogDescription>
            ) : null}
            <DialogClose className="absolute right-2 top-2 z-10 p-1 rounded-md bg-neutral-900 hover:bg-neutral-800 text-red-600">
              <X size={20} />
            </DialogClose>
          </div>
        )}

        {/* CONTENT */}
        <div
          className={[
            "min-h-0",         // allow child to size within the grid row
            "overflow-hidden", // child (e.g., gallery) manages its own internal scroll if needed
            "p-3 sm:p-4",      // compact padding
          ].join(" ")}
        >
          {VisualComp ? (
            // Render child directly — no extra rounded/border wrapper
            <VisualComp {...visualProps} />
          ) : (
            <FallbackViewer payload={payload} />
          )}
        </div>

        {/* Optional external link row */}
        {payload?.url ? (
          <div className="px-3 sm:px-4 pb-3 border-t border-neutral-800 flex justify-end">
            <Button asChild variant="outline" size="sm" className="gap-1">
              <a href={payload.url} target="_blank" rel="noreferrer noopener">
                Open link
                <ExternalLink size={14} />
              </a>
            </Button>
          </div>
        ) : (
          <div /> // keep grid's third row minimal when there's no footer
        )}
      </DialogContent>
    </Dialog>
  );
}

function prettyTitle(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Fallback still works if no registered component; also good for quick tests
function FallbackViewer({ payload }: { payload: VisualPayload | null }) {
  if (!payload?.media) {
    return (
      <div className="text-sm text-neutral-400">
        No visual component registered for{" "}
        <span className="text-emerald-400 font-mono">{payload?.component_name}</span>.
        You can register one in <span className="font-mono">visual-registry.tsx</span>.
      </div>
    );
  }

  const items = Array.isArray(payload.media) ? payload.media : [payload.media];

  return (
    <div className="grid gap-3">
      {items.map((m, i) =>
        m.kind === "image" ? (
          <div key={i} className="relative w-full overflow-hidden rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">
              Image
            </div>
            <img
              src={m.src}
              alt={m?.alt ?? "image"}
              className="w-full h-auto object-cover"
            />
          </div>
        ) : (
          <div key={i} className="relative w-full overflow-hidden rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">
              Video
            </div>
            <video
              controls
              preload="metadata"
              playsInline
              muted
              autoPlay
              className="w-full max-h-[70vh] rounded-b-lg"
              poster={m.poster}
              src={m.src}
            />
          </div>
        )
      )}
    </div>
  );
}