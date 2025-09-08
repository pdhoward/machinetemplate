// components/visual-stage-host.tsx
"use client";

import React, { useImperativeHandle, useState, forwardRef } from "react";
import VisualStage, { VisualPayload } from "@/components/visual-stage";

export type VisualStageHandle = {
  show: (payload: VisualPayload | string) => void;
  hide: () => void;
};

const VisualStageHost = forwardRef<VisualStageHandle, {}>(function VisualStageHost(_, ref) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<VisualPayload | null>(null);

  useImperativeHandle(ref, () => ({
    show: (pl: VisualPayload | string) => {
      setPayload(typeof pl === "string" ? { component_name: pl } : pl);
      setOpen(true);
    },
    hide: () => setOpen(false),
  }));

  return <VisualStage open={open} onOpenChange={setOpen} payload={payload} />;
});

export default VisualStageHost;
