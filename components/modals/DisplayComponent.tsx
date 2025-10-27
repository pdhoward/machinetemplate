"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;                 // used for a11y
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;             // extra classes for content
  closeOnBackdrop?: boolean;      // default true
  showCloseButton?: boolean;      // default true
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

// Lock <body> scroll when open
function useLockBodyScroll(lock: boolean) {
  React.useEffect(() => {
    if (!lock) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [lock]);
}

export default function Modal({
  open,
  onClose,
  children,
  title = "Dialog",
  size = "xl",
  className,
  closeOnBackdrop = true,
  showCloseButton = true,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  useLockBodyScroll(open);

  // Mount portal only on client
  React.useEffect(() => setMounted(true), []);

  // Close on ESC
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus the dialog on open (simple focus management)
  React.useEffect(() => {
    if (open) contentRef.current?.focus();
  }, [open]);

  if (!mounted || !open) return null;

  const maxW =
    size === "sm" ? "sm:max-w-sm" :
    size === "md" ? "sm:max-w-md" :
    size === "lg" ? "sm:max-w-lg" :
    "sm:max-w-4xl"; // xl (default)

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[110] bg-black/80"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={contentRef}
        className={cx(
          "fixed left-1/2 top-1/2 z-[120] w-full -translate-x-1/2 -translate-y-1/2",
          "bg-background text-foreground shadow-xl sm:rounded-xl outline-none",
          "p-0",            // keep zero padding so embedded components (like galleries) control their own layout
          maxW,
          className
        )}
        onClick={(e) => e.stopPropagation()} // prevent backdrop close on inner clicks
      >
        {/* Visually hidden title for a11y; replace with visible header if you prefer */}
        <h2 id={titleId} className="sr-only">{title}</h2>

        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md
                       bg-black/30 text-white/90 hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {children}
      </div>
    </div>,
    document.body
  );
}
