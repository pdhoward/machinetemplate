"use client";

import React from "react";

export default function VideoPlayer({ src = "/videos/placeholder.mp4", poster, compact }: { src?: string; poster?: string; compact?: boolean }) {
  return (
    <div className="relative w-full mx-auto sm:max-w-[800px]">
      <div className={["w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950", compact ? "aspect-[16/10] max-h-[60dvh]" : "aspect-[4/3] max-h-[70dvh] sm:max-h-[600px]"].join(" ")}>
        <video controls preload="metadata" playsInline muted autoPlay poster={poster} className="w-full h-full object-contain" src={src} />
      </div>
    </div>
  );
}
