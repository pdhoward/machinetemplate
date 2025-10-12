// /hooks/use-transcript-sink.ts
"use client";

import { useEffect, useRef } from "react";

type ConvItem = { id: string; role: string; text?: string; timestamp: number };

function postJSON(url: string, body: any) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true, // hint for bg/tab close
  });
}

export function useTranscriptSink(conversation: ConvItem[]) {
  const sentIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<ConvItem[]>([]);
  const timerRef = useRef<number | null>(null);

  // prevent multiple finalize beacons (pagehide + visibilitychange can both fire)
  const finalizedOnceRef = useRef(false);

  // --- normal streaming append (debounced) ---
  useEffect(() => {
    for (const m of conversation) {
      if (!m?.id) continue;
      if (!sentIdsRef.current.has(m.id)) {
        sentIdsRef.current.add(m.id);
        queueRef.current.push(m);
      }
    }

    // debounce flush (~700ms)
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const batch = queueRef.current.splice(0, queueRef.current.length);
      if (!batch.length) return;
      try {
        await postJSON("/api/transcripts/append", {
          messages: batch.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            ts: m.timestamp,
          })),
        });
      } catch {
        // best-effort; next messages still get queued
      }
    }, 700);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [conversation]);

  // --- helpers for tab-close/page-hide ---

  // Flush any queued messages synchronously via sendBeacon/keepalive
  const flushQueuedSync = () => {
    // stop any pending debounce so those messages move into the queue
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const batch = queueRef.current.splice(0, queueRef.current.length);
    if (!batch.length) return;

    const blob = new Blob(
      [
        JSON.stringify({
          messages: batch.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            ts: m.timestamp,
          })),
        }),
      ],
      { type: "application/json" }
    );

    if (navigator.sendBeacon?.("/api/transcripts/append", blob)) {
      return;
    }
    // Fallback
    postJSON("/api/transcripts/append", { messages: batch }).catch(() => {});
  };

  const sendFinalize = () => {
    if (finalizedOnceRef.current) return;
    finalizedOnceRef.current = true;

    const empty = new Blob([], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/transcripts/finalize", empty)) {
      return;
    }
    // Fallback
    postJSON("/api/transcripts/finalize", {}).catch(() => {});
  };

  const flushAndFinalize = () => {
    flushQueuedSync();
    sendFinalize();
  };

  // --- reliable finalize on page lifecycle ---
  useEffect(() => {
    const onPageHide = () => flushAndFinalize(); // most reliable on iOS/Safari
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAndFinalize();
    };
    const onBeforeUnload = () => flushAndFinalize(); // extra safety on desktop

    // capture:true improves chances this runs before page is frozen
    window.addEventListener("pagehide", onPageHide, { capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("pagehide", onPageHide, { capture: true } as any);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
}
