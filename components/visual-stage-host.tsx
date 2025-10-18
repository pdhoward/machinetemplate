// components/visual-stage-host.tsx
"use client";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import VisualStage, { VisualPayload } from "@/components/visual-stage";

export type VisualStageHandle = {
  show: (args: VisualPayload) => void;
  hide: () => void;
  isOpen: () => boolean;
};

const VisualStageHostInner = forwardRef<VisualStageHandle, {}>(function VisualStageHost(_, ref) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<VisualPayload | null>(null);

  const show = useCallback((args: VisualPayload) => {
    setPayload(args);
    setOpen(true);
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  const isOpen = useCallback(() => open, [open]);

  // Guard to avoid setting same value (defensive; Radix usually won’t loop)
  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(prev => (prev === v ? prev : v));
  }, []);

  useImperativeHandle(ref, () => ({ show, hide, isOpen }), [show, hide, isOpen]);

  // Prefer counting renders to a raw stream log
  console.count("[VisualStageHost] RENDER");
  console.log(payload); // comment out or move to an effect if needed

  return (
    <VisualStage 
      open={open} 
      onOpenChange={handleOpenChange} 
      payload={payload} 
      onReplace={(next) => {
        setPayload(next);
        if (!open) setOpen(true);
      }}
      />
    )
});

// ✅ Memoize to block parent-driven re-renders (no props = always equal)
const VisualStageHost = React.memo(VisualStageHostInner);
export default VisualStageHost;
