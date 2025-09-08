// components/visual-stage.tsx
"use client";

import React from "react";
import Image from "next/image";
import { X, Film, Image as ImageIcon, ExternalLink, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getVisualComponent } from "@/components/visual-registry";

export type VisualMedia =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number; blurDataURL?: string }
  | { kind: "video"; src: string; poster?: string };

export type VisualPayload = {
  component_name: string;              // e.g. "payment_form" | "gallery" | "room_details"
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";           // controls modal width
  props?: Record<string, any>;         // passed to registered component
  media?: VisualMedia | VisualMedia[]; // optional media to show
  url?: string;                        // optional external link
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: VisualPayload | null;
};

const sizeToWidth: Record<NonNullable<VisualPayload["size"]>, string> = {
  sm: "w-[380px]",
  md: "w-[560px]",
  lg: "w-[840px]",
};

export default function VisualStage({ open, onOpenChange, payload }: Props) {
  const size = payload?.size ?? "lg";
  const title = payload?.title ?? prettyTitle(payload?.component_name ?? "Preview");
  const description = payload?.description ?? "";

  // Try to pull a registered React component for this name
  const VisualComp = payload?.component_name ? getVisualComponent(payload.component_name) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "bg-neutral-900 text-neutral-200 border border-neutral-800",
          "max-w-[92vw] p-0 overflow-hidden",
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
            <Button
              variant="ghost"
              size="icon"
              className="text-neutral-400 hover:text-neutral-200"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X size={16} />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-5 pb-5">
          {/* 1) Registered component takes precedence */}
          {VisualComp ? (
            <div className="rounded-lg border border-neutral-800 p-4">
              <VisualComp {...(payload?.props ?? {})} />
            </div>
          ) : (
            // 2) Fallback viewer for media or URL
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

function FallbackViewer({ payload }: { payload: VisualPayload | null }) {
  if (!payload?.media) {
    return (
      <div className="text-sm text-neutral-400">
        No visual component registered for <span className="text-emerald-400 font-mono">{payload?.component_name}</span>.
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
            <div className="relative">
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
          </div>
        ) : (
          <div key={i} className="relative w-full overflow-hidden rounded-lg border border-neutral-800">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400 border-b border-neutral-800">
              <Film size={14} />
              Video
            </div>
            <video
              controls
              poster={m.poster}
              className="w-full rounded-b-lg"
              src={m.src}
            />
          </div>
        )
      )}
    </div>
  );
}
