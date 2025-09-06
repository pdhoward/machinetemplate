"use client";

import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TriggerIconButton from "./TriggerIconButton";
import { FileOutput } from "lucide-react";

type Props = {
  events: any[];
};

function summarizeEvent(ev: any): string {
  try {
    if (ev.type === "response.text.delta") return `Δ text: ${ev.delta}`;
    if (ev.type === "response.audio_transcript.delta") return `Δ audio: ${ev.delta}`;
    if (ev.type?.startsWith("conversation.item.input_audio_transcription"))
      return `${ev.type}${ev.transcript ? ` → ${ev.transcript}` : ""}`;
    if (ev.type === "response.function_call_arguments.done")
      return `tool: ${ev.name} args: ${ev.arguments?.slice?.(0, 120) ?? ""}`;
    if (ev.type === "error") return `ERROR: ${JSON.stringify(ev.error).slice(0, 200)}`;
    return `${ev.type ?? "event"} ${ev.item?.id ?? ev.item_id ?? ""}`.trim();
  } catch {
    return String(ev?.type ?? "event");
  }
}

export default function LogsDialogTrigger({ events }: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const list = (events ?? []).map((ev, i) => ({
      id: String(ev?.item?.id ?? ev?.item_id ?? i),
      text: summarizeEvent(ev),
    }));
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.text.toLowerCase().includes(q));
  }, [events, query]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <TriggerIconButton title="System Logs">
          <FileOutput size={14} />
        </TriggerIconButton>
      </DialogTrigger>
      <DialogContent className="bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[90vw] max-h-[80vh] w-[400px] h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle>System Logs</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search logs..."
            className="w-full p-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-lg border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-gold-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto text-xs text-neutral-400 mt-2">
          {rows.length > 0 ? (
            rows.map((r, i) => (
              <p key={i} className="border-b border-neutral-700 py-1">
                {r.text}
              </p>
            ))
          ) : (
            <p>No logs available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
