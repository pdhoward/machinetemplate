"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DisplayProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children?: React.ReactNode;
};

const sizeMap: Record<NonNullable<DisplayProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function DisplayComponent({
  open,
  onClose,
  title,
  size = "md",
  className,
  children,
}: DisplayProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Close on ESC, but don't bubble to global handlers
  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onClose?.();
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-center justify-center"
      // prevent any bubbling to page/global listeners
      onKeyDownCapture={onKeyDownCapture}
      onClickCapture={(e) => e.stopPropagation()}
      onMouseDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
    >
      {/* Overlay — DO NOT close on overlay click; we swallow events */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={(e) => {
          // explicit close only; ignore overlay clicks
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {/* Content */}
      <div
        className={cn(
          "relative z-[121] w-[94vw] sm:w-auto border border-neutral-800 bg-neutral-950 text-white shadow-2xl rounded-xl",
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-800">
          <div className="text-sm font-semibold truncate">{title}</div>
          <button
            aria-label="Close"
            title="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/40
                       text-red-400 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          className={cn(
            "p-4",
            sizeMap[size],
            "max-h-[85vh] overflow-y-auto",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}