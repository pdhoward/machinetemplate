"use client";

import React from "react";

type Msg = { id: string; role: "user" | "assistant" | "system"; text: string; timestamp: number };

export default function TranscriptPanel({
  open,
  conversation,
}: {
  open: boolean;
  conversation: Msg[];
}) {
  return (
    <div
      className={[
        "absolute left-2 right-2 bottom-14 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur",
        "shadow-lg transition-all duration-200",
        open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none",
      ].join(" ")}
      style={{ maxHeight: 220 }}
    >
      <div className="p-2 text-[11px] text-neutral-400 uppercase tracking-wide border-b border-neutral-800">
        Transcript
      </div>
      <div className="p-2 overflow-y-auto text-xs text-neutral-300 space-y-1" style={{ maxHeight: 180 }}>
        {conversation.length === 0 ? (
          <div className="text-neutral-500">No messages yet.</div>
        ) : (
          conversation.slice(-40).map((m) => (
            <div key={m.id} className="leading-snug">
              <span className="text-neutral-400 mr-1">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className={m.role === "user" ? "text-emerald-400" : m.role === "assistant" ? "text-cyan-300" : "text-neutral-400"}>
                {m.role}:
              </span>{" "}
              <span className="text-neutral-200">{m.text || "…"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
