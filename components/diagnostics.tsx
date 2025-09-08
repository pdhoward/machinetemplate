// components/diagnostics.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, X } from "lucide-react";

// Narrow type so TS knows these may exist on your client
type MaybeRTCClient = {
  getPeerConnection?: () => RTCPeerConnection | null;
  getDataChannel?: () => RTCDataChannel | null;
  getLocalStream?: () => MediaStream | null; // optional helper your client may expose
};

type Props = {
  status: string;
  volume: number; // assistant outbound RMS
  events: any[];
  getClient: () => MaybeRTCClient | any;
};

export function Diagnostics({ status, volume, events, getClient }: Props) {
  const [dcState, setDcState] = useState<string>("unknown");
  const [ice, setIce] = useState<string>("unknown");
  const [open, setOpen] = useState(false);
  const [micRms, setMicRms] = useState<number>(0);

  // Keep audio nodes across renders for proper cleanup
  const audioRef = useRef<{
    ctx: AudioContext | null;
    analyser: AnalyserNode | null;
    src: MediaStreamAudioSourceNode | null;
    raf: number | null;
  } | null>(null);

  useEffect(() => {
    const client: MaybeRTCClient | undefined = getClient?.();
    const pc: RTCPeerConnection | null | undefined = client?.getPeerConnection?.();
    const dc: RTCDataChannel | null | undefined = client?.getDataChannel?.();

    // --- DC / ICE watchers
    const updateDC = () => setDcState(dc?.readyState ?? "n/a");
    const updateICE = () => setIce(pc?.iceConnectionState ?? "unknown");

    updateDC();
    updateICE();

    dc?.addEventListener("open", updateDC);
    dc?.addEventListener("close", updateDC);
    dc?.addEventListener("error", updateDC);
    pc?.addEventListener("iceconnectionstatechange", updateICE);

    // --- Mic RMS analyser
    const cleanupAudio = () => {
      const a = audioRef.current;
      if (!a) return;
      if (a.raf) cancelAnimationFrame(a.raf);
      try { a.src?.disconnect(); } catch {}
      try { a.analyser?.disconnect(); } catch {}
      try { a.ctx?.close(); } catch {}
      audioRef.current = null;
    };

    const wireMicAnalyser = async () => {
      // always reset first
      cleanupAudio();

      if (status !== "CONNECTED") {
        setMicRms(0);
        return;
      }

      // Prefer a direct local stream if available
      let track: MediaStreamTrack | null = null;
      const localStream: MediaStream | null | undefined = client?.getLocalStream?.();
      if (localStream?.getAudioTracks?.()?.length) {
        track = localStream.getAudioTracks()[0] || null;
      }

      // Fallback: inspect RTCPeerConnection senders
      if (!track && pc?.getSenders) {
        const snd = pc.getSenders().find(s => s.track?.kind === "audio");
        track = snd?.track ?? null;
      }

      if (!track) {
        setMicRms(0);
        return;
      }

      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx: AudioContext = new Ctx();
      const stream = new MediaStream([track]);
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);

      audioRef.current = { ctx, analyser, src, raf: null };

      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        // defensive if cleaned up
        const a = audioRef.current;
        if (!a?.analyser) return;
        a.analyser.getByteTimeDomainData(buf);

        // Compute RMS 0..1 from time-domain (centered at 128)
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        setMicRms(Math.sqrt(sum / buf.length));
        a.raf = requestAnimationFrame(loop);
      };
      loop();
    };

    wireMicAnalyser();

    // Cleanup listeners + audio
    return () => {
      dc?.removeEventListener("open", updateDC);
      dc?.removeEventListener("close", updateDC);
      dc?.removeEventListener("error", updateDC);
      pc?.removeEventListener("iceconnectionstatechange", updateICE);
      cleanupAudio();
    };
  }, [getClient, status]); // rewire on status changes (e.g., connect/disconnect)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60]">
      <div className="mx-auto max-w-screen-2xl">
        {open ? (
          // Diagnostics bar (short + spread)
          <div className="border-t border-neutral-800 bg-neutral-900/90 backdrop-blur-sm">
            <div className="px-3 py-1.5 text-[11px] text-neutral-300 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>status: <span className="font-mono">{status}</span></span>
                <span>dc: <span className="font-mono">{dcState}</span></span>
                <span>ice: <span className="font-mono">{ice}</span></span>
                <span>rms(in): <span className="font-mono">{micRms.toFixed(3)}</span></span>
                <span>rms(out): <span className="font-mono">{volume.toFixed(3)}</span></span>
                <span>events: <span className="font-mono">{events.length}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                  onClick={() => ((window as any).rtc = getClient())}
                  title="Expose client as window.rtc"
                >
                  expose window.rtc
                </button>
                <button
                  className="inline-flex items-center justify-center w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                  onClick={() => setOpen(false)}
                  title="Hide diagnostics"
                  aria-label="Hide diagnostics"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Footer (short)
          <div className="border-t border-neutral-800 bg-neutral-900/90 backdrop-blur-sm">
            <div className="px-3 py-1.5 text-[12px] text-neutral-300 flex items-center justify-between">
              <span>
                © 2024 Strategic Machines.{" "}
                <span className="hidden sm:inline">Built in Austin, Texas.</span>
              </span>
              <button
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                onClick={() => setOpen(true)}
                title="Show diagnostics"
                aria-expanded={open}
                aria-controls="diagnostics-bar"
              >
                <Activity size={14} />
                Monitor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Diagnostics;
