// /hooks/use-transcript-sink.ts
"use client";

import { useEffect, useRef } from "react";

type ConvItem = { id: string; role: "user" | "assistant" | "tool" | "system"; text?: string; timestamp: number };

const USER_PLACEHOLDER_RE = /^processing speech/i;
const STABILIZE_MS = 400; // small wait so text can settle

function postJSON(url: string, body: any) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

export function useTranscriptSink(conversation: ConvItem[]) {
  const sentIds = useRef<Set<string>>(new Set());
  const queue = useRef<ConvItem[]>([]);
  const debounceTimer = useRef<number | null>(null);
  const finalizedOnce = useRef(false);

  // track first time we saw this id with non-empty text
  const firstSeenAt = useRef<Map<string, number>>(new Map());
  // track last text per id (so we don’t “stabilize” on a changing text)
  const lastText = useRef<Map<string, string>>(new Map());

  const flushQueue = async (useBeacon = false) => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    const batch = queue.current.splice(0, queue.current.length);
    if (!batch.length) return;

    const payload = {
      messages: batch.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        ts: m.timestamp,
      })),
    };

    if (useBeacon && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/transcripts/append", blob);
      return;
    }
    try {
      await postJSON("/api/transcripts/append", payload);
    } catch {}
  };

  const finalizeNow = async (useBeacon = false) => {
    if (finalizedOnce.current) return;
    finalizedOnce.current = true;
    await flushQueue(useBeacon);
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/transcripts/finalize", new Blob([], { type: "application/json" }));
      return;
    }
    try {
      await fetch("/api/transcripts/finalize", { method: "POST", keepalive: true });
    } catch {}
  };

  useEffect(() => {
    const now = Date.now();

    for (const m of conversation) {
      if (!m?.id) continue;
      if (sentIds.current.has(m.id)) continue;

      const text = (m.text ?? "").trim();
      if (!text) continue; // don’t persist empties

      // Skip obvious placeholder
      if (m.role === "user" && USER_PLACEHOLDER_RE.test(text)) continue;

      // stabilization logic: if text changed, reset the clock
      const prev = lastText.current.get(m.id);
      if (prev !== text) {
        lastText.current.set(m.id, text);
        firstSeenAt.current.set(m.id, now);
        continue; // see the same text once more (after STABILIZE_MS)
      }

      // wait a tiny bit so the final text “sticks”
      const seenAt = firstSeenAt.current.get(m.id) ?? now;
      if (now - seenAt < STABILIZE_MS) continue;

      // looks stable — enqueue and mark sent
      queue.current.push({ ...m, text });
      sentIds.current.add(m.id);

      // debounce writes
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
      debounceTimer.current = window.setTimeout(() => {
        void flushQueue(false);
      }, 700) as unknown as number;
    }

    return () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [conversation]);

  // finalize on close/background
  useEffect(() => {
    const onPageHide = () => finalizeNow(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") finalizeNow(true);
    };
    const onBeforeUnload = () => finalizeNow(true);

    window.addEventListener("pagehide", onPageHide, { capture: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("pagehide", onPageHide, { capture: true } as any);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return {
    flushNow: () => flushQueue(false),
    finalizeNow: () => finalizeNow(false),
  };
}
