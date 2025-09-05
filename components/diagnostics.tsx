"use client"

import { useEffect, useState } from 'react'

export function Diagnostics({ status, volume, events, getClient }: {
  status: string; volume: number; events: any[]; getClient: () => any;
}) {
  const [dcState, setDcState] = useState<string>("unknown");
  const [ice, setIce] = useState<string>("unknown");

  useEffect(() => {
    const c = getClient();
    // datachannel state
    setDcState(c?.getDataChannel?.()?.readyState ?? "n/a");
    // ice connection state (optional if you exposed pc; if not, this stays 'n/a')
    const pc = (c as any)?.pc; // if you kept pc private, ignore this
    if (pc) {
      const update = () => setIce(pc.iceConnectionState);
      pc.addEventListener("iceconnectionstatechange", update);
      update();
      return () => pc.removeEventListener("iceconnectionstatechange", update);
    }
  }, [getClient]);

  return (
    <div className="mt-4 text-xs rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-neutral-300 space-y-1">
      <div>status: <span className="font-mono">{status}</span></div>
      <div>dc: <span className="font-mono">{dcState}</span></div>
      <div>ice: <span className="font-mono">{ice}</span></div>
      <div>rms: <span className="font-mono">{volume.toFixed(3)}</span></div>
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
