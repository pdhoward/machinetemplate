"use client";

import React from "react";
import Image from "next/image";

export default function ImageViewer({
  src = "/images/placeholder-room.jpg",
  alt = "image",
  width = 640,
  height = 420,
  compact,
}: { src?: string; alt?: string; width?: number; height?: number; compact?: boolean }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="relative">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 640px) 100vw, 640px"
          className="w-full h-auto object-cover"
          priority={compact}
        />
      </div>
    </div>
  );
}
