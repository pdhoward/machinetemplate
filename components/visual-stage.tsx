// components/visual-stage.tsx
"use client";

import React from "react";
import { getVisualComponent } from "@/components/visuals/registry";
import { Card, CardContent } from "@/components/ui/card";

export type VisualPayload = {
  component_name: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  props?: Record<string, any>;
  media?: any[];
  url?: string;
};

export type VisualStageHandle = {
  show: (payload: VisualPayload) => void;
  hide: () => void;
};

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

export default function VisualStage(
  { initialOpen = false }: { initialOpen?: boolean },
) {
  const [open, setOpen] = React.useState(initialOpen);
  const [payload, setPayload] = React.useState<VisualPayload | null>(null);

  // expose an imperative handle (if you’re already forwarding a ref elsewhere)
  // Example usage elsewhere: stageRef.current?.show(payload)
  // Omit if you already have this in a “host” wrapper.
  React.useImperativeHandle(
    (globalThis as any).__VISUAL_STAGE_REF__ ?? React.createRef<VisualStageHandle>(),
    () => ({
      show: (p: any) => { setPayload(p); setOpen(true); },
      hide: () => setOpen(false),
    }),
    []
  );

  if (!open || !payload) return null;

  const Comp = getVisualComponent(payload.component_name);

  if (!Comp) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardContent className="p-6 text-neutral-400 text-sm">
          Unknown component: <span className="text-neutral-200">{payload.component_name}</span>
        </CardContent>
      </Card>
    );
  }

  // Pass payload.props (your existing convention), while still allowing media/url/title mirroring upstream
  return (
    <VisualErrorBoundary>
      <React.Suspense fallback={<FallbackSkeleton />}>
        <Comp {...(payload.props || {})} />
      </React.Suspense>
    </VisualErrorBoundary>
  );
}
