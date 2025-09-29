// components/visual-stage-host.tsx
"use client";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import VisualStage, { VisualPayload } from "@/components/visual-stage";

export type VisualStageHandle = {
  show: (args: VisualPayload) => void;
  hide: () => void;
  isOpen: () => boolean;
};

const VisualStageHost = forwardRef<VisualStageHandle, {}>(function VisualStageHost(_, ref) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<VisualPayload | null>(null);

  const show = (args: VisualPayload) => { setPayload(args); setOpen(true); };
  const hide = () => setOpen(false);
  const isOpen = () => open;

  useImperativeHandle(ref, () => ({ show, hide, isOpen }), [open]);

  return <VisualStage open={open} onOpenChange={setOpen} payload={payload} />;
});

export default VisualStageHost;