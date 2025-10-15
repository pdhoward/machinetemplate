// components/visual-stage.tsx
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

// Desktop/tablet width caps (applied at sm+)
const sizeToMaxWidth: Record<NonNullable<VisualPayload["size"]>, string> = {
  sm: "sm:max-w-[380px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[840px]",
  xl: "sm:max-w-[1120px]",
};

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
  const rawTitle = payload?.title ?? prettyTitle(payload?.component_name ?? "Preview");
  const titleText = rawTitle?.trim() || "Media viewer";
  const description = payload?.description?.trim() || "";
  const VisualComp = payload?.component_name ? getVisualComponent(payload.component_name) : null;

  const visualProps = {
    compact: true,
    ...(payload?.props ?? {}),
    media: payload?.media ?? payload?.props?.media,
  };

  const showHeader = payload?.component_name ? !HAS_OWN_CHROME.has(payload.component_name) : true;
  const titleId = "visual-stage-title";
  const descId = "visual-stage-desc";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={[
          // Surface & stacking
          "bg-neutral-900 text-neutral-200 border border-neutral-800 overflow-hidden z-[120]",
          // Centered modal at all sizes (uses shadcn's left/top translate)
          // PHONE: clamp width/height so it never hits header or footer
          "w-[min(96vw,430px)] max-h-[min(90dvh,720px)]",
          "rounded-xl",
          // Layout: header / scrollable content / footer
          "p-0 grid grid-rows-[auto,1fr,auto]",
          "overscroll-contain",
          // TABLET/DESKTOP: widen & raise height cap
          "sm:w-[92vw] sm:max-h-[min(85vh,900px)]",
          sizeToMaxWidth[size],
          // Optional: on very tall desktops you can increase rounding
          "sm:rounded-2xl",
        ].join(" ")}
      >
        {/* a11y title always present */}
        <VisuallyHidden>
          <DialogTitle>{titleText}</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        {showHeader ? (
          <DialogHeader className="px-4 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-neutral-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle id={titleId} className="text-sm sm:text-base font-medium truncate">
                  {titleText}
                </DialogTitle>
                {description ? (
                  <DialogDescription id={descId} className="mt-1 text-xs sm:text-sm text-neutral-400 line-clamp-2">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
              <DialogClose
                className="p-2 rounded-md hover:bg-neutral-800 text-neutral-300 shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </DialogClose>
            </div>
          </DialogHeader>
        ) : (
          <div className="relative">
            <DialogTitle className="sr-only" id={titleId}>
              {titleText}
            </DialogTitle>
            {description ? (
              <DialogDescription className="sr-only" id={descId}>
                {description}
              </DialogDescription>
            ) : null}
            <DialogClose
              className="absolute right-2 top-2 z-10 p-2 rounded-md bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200"
              aria-label="Close"
            >
              <X size={20} />
            </DialogClose>
          </div>
        )}

        {/* CONTENT (scrolls; never pushes header/footer out) */}
        <div className="min-h-0 overflow-auto p-3 sm:p-5 overscroll-y-contain">
          {VisualComp ? <VisualComp {...visualProps} /> : <FallbackViewer payload={payload} />}
        </div>

        {/* FOOTER always reserved so it can't vanish on tiny viewports */}
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-neutral-800 flex justify-end min-h-[40px]">
          {payload?.url ? (
            <Button asChild variant="outline" size="sm" className="gap-1">
              <a href={payload.url} target="_blank" rel="noreferrer noopener">
                Open link
                <ExternalLink size={14} />
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function prettyTitle(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function FallbackViewer({ payload }: { payload: VisualPayload | null }) {
  if (!payload?.media) {
    return (
      <div className="text-sm text-neutral-400">
        No visual component registered for{" "}
        <span className="text-emerald-400 font-mono">{payload?.component_name}</span>.
        Register one in <span className="font-mono">visual-registry.tsx</span>.
      </div>
    );
  }
  const items = Array.isArray(payload.media) ? payload.media : [payload.media];
  return (
    <div className="grid gap-3 sm:gap-4">
      {items.map((m, i) =>
        m.kind === "image" ? (
          <div key={i} className="relative w-full overflow-hidden rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">
              Image
            </div>
            <img src={m.src} alt={m?.alt ?? "image"} className="block w-full h-auto object-cover" />
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
              className="block w-full max-h-[70vh] sm:max-h-[60vh] rounded-b-lg object-contain"
              poster={m.poster}
              src={m.src}
            />
          </div>
        )
      )}
    </div>
  );
}
