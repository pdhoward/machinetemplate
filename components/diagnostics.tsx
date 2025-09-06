// components/diagnostics.tsx
"use client";
import { useEffect, useState } from "react";

export function Diagnostics({ status, volume, events, getClient }: {
  status: string; volume: number; events: any[]; getClient: () => any;
}) {
  const [dcState, setDcState] = useState<string>("unknown");
  const [ice, setIce] = useState<string>("unknown");

  useEffect(() => {
    const c = getClient?.();
    const dc = c?.getDataChannel?.();
    const pc = c?.getPeerConnection?.();

    if (dc) {
      const update = () => setDcState(dc.readyState);
      update();
      dc.addEventListener("open", update);
      dc.addEventListener("close", update);
      dc.addEventListener("error", update);
      return () => {
        dc.removeEventListener("open", update);
        dc.removeEventListener("close", update);
        dc.removeEventListener("error", update);
      };
    } else {
      setDcState("n/a");
    }

    if (pc) {
      const onIce = () => setIce(pc.iceConnectionState);
      pc.addEventListener("iceconnectionstatechange", onIce);
      onIce();
      return () => pc.removeEventListener("iceconnectionstatechange", onIce);
    } else {
      setIce("unknown");
    }
  }, [getClient, status]);

  return (
    <div className="mt-4 text-xs rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-neutral-300 space-y-1">
      <div>status: <span className="font-mono">{status}</span></div>
      <div>dc: <span className="font-mono">{dcState}</span></div>
      <div>ice: <span className="font-mono">{ice}</span></div>
      <div>rms(out): <span className="font-mono">{volume.toFixed(3)}</span></div>
      <div>events: <span className="font-mono">{events.length}</span></div>
      <button
        className="mt-2 px-2 py-1 rounded bg-neutral-700"
        onClick={() => (window as any).rtc = getClient()}
        title="Expose client as window.rtc"
      >
        expose window.rtc
      </button>
    </div>
  );
}
