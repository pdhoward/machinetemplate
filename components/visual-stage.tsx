// components/visual-stage.tsx
"use client";

import React from "react";
import { getVisualComponent } from "@/components/visuals/registry";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export type VisualPayload = {
  component_name: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  props?: Record<string, any>;
  media?: any[];       // mirrored into props.media if missing
  url?: string;        // footer link (optional)
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: VisualPayload | null;
  onReplace?: (next: VisualPayload) => void;
};

// Desktop/tablet width caps (applied at sm+)
const sizeToMaxWidth: Record<NonNullable<VisualPayload["size"]>, string> = {
  sm: "sm:max-w-[380px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[840px]",
  xl: "sm:max-w-[1120px]",
};

// Components that render their own chrome (header/close etc.)
const HAS_OWN_CHROME = new Set([
  "payment_form",
  "quote_summary",
  "catalog_results",
  "reservation_confirmation",
  "room",
  "media_gallery",
  "image_viewer",
  "video",
]);

function FallbackSkeleton() {
  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardContent className="p-6 text-neutral-400 text-sm">Loading…</CardContent>
    </Card>
  );
}

class VisualErrorBoundary extends React.Component<{ children: React.ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-6">
            <div className="text-red-400 text-sm font-medium">Failed to render visual.</div>
            <div className="text-neutral-400 text-xs mt-1">{this.state.err.message}</div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default function VisualStage({ open, onOpenChange, payload, onReplace }: Props) {
  console.groupCollapsed("[VisualStage] render");
  console.log("open:", open);
  console.log("payload:", payload);
  console.groupEnd();

  // Don’t portal anything if closed or no payload
  if (!open || !payload) return null;

  const size = payload.size ?? "md";
  const rawTitle = payload.title ?? prettyTitle(payload.component_name ?? "Preview");
  const titleText = rawTitle?.trim() || "Media viewer";
  const description = payload.description?.trim() || "";

  const Comp = payload.component_name ? getVisualComponent(payload.component_name) : null;

  // Mirror top-level → props so legacy callers still work
  const mergedProps: Record<string, any> = {
    ...(payload.props || {}),
    ...(payload.media && !payload.props?.media ? { media: payload.media } : {}),
    ...(payload.title && !payload.props?.title ? { title: payload.title } : {}),
    ...(payload.description && !payload.props?.description ? { description: payload.description } : {}),
    ...(payload.url && !payload.props?.url ? { url: payload.url } : {}),
    compact: true,
  };

  const showHeader = payload.component_name ? !HAS_OWN_CHROME.has(payload.component_name) : true;
  const titleId = "visual-stage-title";
  const descId = "visual-stage-desc";

   // 👇 helper for immediate agent speech
  const say = (text: string) => {
    window.dispatchEvent(new CustomEvent("agent-say", { detail: { text } }));
  };

  // 👇 If this is the payment form, compose a default onPaid
  if (payload.component_name === "payment_form") {
    const userOnPaid = mergedProps.onPaid as ((info: { paymentIntentId: string }) => void) | undefined;
    mergedProps.onPaid = (info: { paymentIntentId: string }) => {
      // 1) Tenant override runs first
      userOnPaid?.(info);

      // 2) Swap to a confirmation visual (if host provided onReplace)
      onReplace?.({
        component_name: "reservation_confirmation",
        title: "Payment received",
        description: `Your payment is confirmed. Reference: ${info.paymentIntentId}`,
        size: "md",
        props: { paymentIntentId: info.paymentIntentId },
      });

      // 3) Let the agent acknowledge immediately
      say("Thanks! Your payment has been received and your booking is confirmed.");
    };
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        // Restored modal styling & centering (same spirit as your original)
        className={[
          // Surface & stacking
          "bg-neutral-900 text-neutral-200 border border-neutral-800 overflow-hidden z-[120]",
          // Centered modal at all sizes (shadcn handles the portal + centering)
          "w-[min(96vw,430px)] max-h-[min(90dvh,720px)]",
          "rounded-xl",
          // Layout: header / scrollable content / footer
          "p-0 grid grid-rows-[auto,1fr,auto]",
          "overscroll-contain",
          // TABLET/DESKTOP: widen & raise height cap
          "sm:w-[92vw] sm:max-h-[min(85vh,900px)]",
          sizeToMaxWidth[size],
          "sm:rounded-2xl",
        ].join(" ")}
      >
        {/* A11y title always present */}
        <VisuallyHidden>
          <DialogTitle>{titleText}</DialogTitle>
        </VisuallyHidden>

        {/* Header (hidden if the child renders its own chrome) */}
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
          {!Comp ? (
            <UnknownComponent name={payload.component_name} />
          ) : (
            <VisualErrorBoundary>
              <React.Suspense fallback={<FallbackSkeleton />}>
                <Comp {...mergedProps} />
              </React.Suspense>
            </VisualErrorBoundary>
          )}
        </div>

        {/* FOOTER (optional link) */}
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-neutral-800 flex justify-end min-h-[40px]">
          {payload.url ? (
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

function UnknownComponent({ name }: { name?: string }) {
  console.warn("[VisualStage] Unknown component:", name);
  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardContent className="p-6 text-neutral-400 text-sm">
        Unknown component: <span className="text-neutral-200">{name}</span>
      </CardContent>
    </Card>
  );
}

function prettyTitle(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
