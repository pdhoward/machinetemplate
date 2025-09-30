
"use client";

import React from "react";
import Image from "next/image";
import { Film, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getVisualComponent } from "@/components/visual-registry";

export type VisualMedia =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number; blurDataURL?: string }
  | { kind: "video"; src: string; poster?: string };

export type VisualPayload = {
  component_name: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";   // <-- CHANGE: add "xl"
  props?: Record<string, any>;
  media?: VisualMedia | VisualMedia[];
  url?: string;
};

type Props = { open: boolean; onOpenChange: (v: boolean) => void; payload: VisualPayload | null };

const sizeToWidth: Record<NonNullable<VisualPayload["size"]>, string> = {
  sm: "w-[380px]",
  md: "w-[560px]",
  lg: "w-[840px]",
  xl: "w-[1120px]",                 // <-- CHANGE: support larger modal
};

export default function VisualStage({ open, onOpenChange, payload }: Props) {
  const size = payload?.size ?? "lg";
  const title = payload?.title ?? prettyTitle(payload?.component_name ?? "Preview");
  const description = payload?.description ?? "";

  const VisualComp = payload?.component_name ? getVisualComponent(payload.component_name) : null;

  // pass-through payload.media to component props automatically
  const visualProps = { ...(payload?.props ?? {}), media: payload?.media ?? payload?.props?.media };

  // --- DEBUG ---
  if (process.env.NODE_ENV !== "production") {
    console.debug("[VisualStage] payload", payload);
    console.debug("[VisualStage] visualProps (to component)", visualProps);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "bg-neutral-900 text-neutral-200 border border-neutral-800",
          "max-w-[92vw] p-0 overflow-hidden",
          "max-h-[92vh]",           // <-- CHANGE: allow taller viewport
          sizeToWidth[size],
        ].join(" ")}
      >
        <DialogHeader className="px-5 pt-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-base">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-xs text-neutral-400">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {/* CHANGE: give content area a scroll and height cap */}
        <div className="px-5 pb-5 max-h-[80vh] overflow-auto">
          {VisualComp ? (
            <div className="rounded-lg border border-neutral-800 p-4">
              <VisualComp {...visualProps} />
            </div>
          ) : (
            <FallbackViewer payload={payload} />
          )}

          {payload?.url ? (
            <div className="mt-4 flex justify-end">
              <Button asChild variant="outline" size="sm" className="gap-1">
                <a href={payload.url} target="_blank" rel="noreferrer noopener">
                  Open link
                  <ExternalLink size={14} />
                </a>
              </Button>
            </div>
          ) : null}
        </div>
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
              <ImageIcon size={14} />
              Image
            </div>
            <Image
              src={m.src}
              alt={m?.alt ?? "image"}
              width={m.width ?? 800}
              height={m.height ?? 500}
              placeholder={m.blurDataURL ? "blur" : "empty"}
              blurDataURL={m.blurDataURL}
              className="w-full h-auto object-cover"
            />
          </div>
        ) : (
          <div key={i} className="relative w-full overflow-hidden rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">
              <Film size={14} />
              Video
            </div>
            <video
              controls
              preload="metadata"
              playsInline
              muted                // autoplay policy: muted required
              autoPlay             // start right away (muted); user can unmute
              poster={m.poster}
              className="w-full max-h-[78vh] rounded-b-lg"
              src={m.src}
            />
          </div>
        )
      )}
    </div>
  );
}
