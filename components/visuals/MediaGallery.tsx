"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export type VisualMediaMG =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number }
  | { kind: "video"; src: string; poster?: string };

export default function MediaGallery({ media = [], startIndex = 0, title, compact = false }: {
  media?: VisualMediaMG[];
  startIndex?: number;
  title?: string;
  compact?: boolean;
}) {
  const [idx, setIdx] = React.useState(Math.min(Math.max(0, startIndex), Math.max(0, media.length - 1)));
  const cur = media[idx];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(media.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media.length]);

  if (media.length === 0) return <div className="text-sm text-neutral-400">No media available.</div>;

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{title || "Media Gallery"}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">{idx + 1} / {media.length}</CardDescription>
      </CardHeader>

      <CardContent className={compact ? "pt-0 px-4 pb-3" : undefined}>
        <div className="w-full mx-auto" style={{ maxWidth: compact ? 880 : 800 }}>
          <div className="relative w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className={compact ? "aspect-[16/10] max-h-[60dvh] sm:max-h-[520px] w-full" : "aspect-[4/3] max-h-[70dvh] sm:max-h-[600px] w-full"}>
              {cur?.kind === "image" ? (
                <Image src={cur.src} alt={("alt" in cur && cur.alt) || "image"} fill sizes="(max-width: 1120px) 100vw, 1120px" className="object-contain" />
              ) : (
                <video key={cur.src} controls preload="metadata" playsInline muted autoPlay poster={("poster" in cur && cur.poster) || undefined} className="w-full h-full object-contain" src={cur.src} />
              )}
            </div>

            <div className="absolute inset-y-0 left-0 flex items-center">
              <button className="m-2 rounded bg-black/50 hover:bg-black/70 text-white text-sm px-2 py-1" onClick={() => setIdx((i) => Math.max(0, i - 1))} aria-label="Previous">←</button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button className="m-2 rounded bg-black/50 hover:bg-black/70 text-white text-sm px-2 py-1" onClick={() => setIdx((i) => Math.min(media.length - 1, i + 1))} aria-label="Next">→</button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <ScrollArea className="w-full">
            <div className="flex gap-2">
              {media.map((m, i) => {
                const isActive = i === idx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    title={`Go to media ${i + 1}`}
                    className={[
                      "relative overflow-hidden rounded border",
                      isActive ? "border-emerald-500 ring-1 ring-emerald-500" : "border-neutral-800",
                      compact ? "w-[72px] h-[54px]" : "w-[96px] h-[72px]",
                      "bg-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    ].join(" ")}
                    aria-label={`Go to media ${i + 1}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {m.kind === "image" ? (
                      <Image src={m.src} alt={("alt" in m && m.alt) || `thumb ${i + 1}`} fill sizes={compact ? "72px" : "96px"} className="object-cover" />
                    ) : (
                      <div className="grid place-items-center w-full h-full text-[10px] text-neutral-300">Video<span className="sr-only">Video thumbnail</span></div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
