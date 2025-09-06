"use client";

import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TriggerIconButton from "./TriggerIconButton";
import { Captions, Download } from "lucide-react";

type ConvItem = { id: string; role: string; text?: string; timestamp: number };

type Props = {
  conversation: ConvItem[];
  onDownload: () => void;
};

export default function TranscriptDialogTrigger({ conversation, onDownload }: Props) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = Array.isArray(conversation) ? conversation : [];
    const query = q.trim().toLowerCase();
    if (!query) return list.slice(-200);
    return list
      .filter((m) => {
        const text = (m.text || "").toLowerCase();
        const role = (m.role || "").toLowerCase();
        return text.includes(query) || role.includes(query);
      })
      .slice(-200);
  }, [conversation, q]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <TriggerIconButton title="Transcripts">
          <Captions size={14} />
        </TriggerIconButton>
      </DialogTrigger>

      <DialogContent className="bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[90vw] max-h-[80vh] w-[420px] h-[440px] flex flex-col">
        <DialogHeader>
          <div className="flex items-center">
            <DialogTitle className="text-base">Transcripts</DialogTitle>
            <button
              onClick={onDownload}
              className="ml-2 inline-flex items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600 text-white w-6 h-6"
              title="Download Transcription"
              aria-label="Download Transcription"
            >
              <Download size={12} />
            </button>
          </div>
        </DialogHeader>

        <div className="mt-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transcripts..."
            className="w-full p-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-lg border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-gold-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto text-xs text-neutral-300 mt-2">
          {rows.length > 0 ? (
            rows.map((m) => (
              <div key={m.id} className="border-b border-neutral-800 py-1.5 leading-snug">
                <span className="text-neutral-400 mr-1">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span
                  className={
                    m.role === "user"
                      ? "text-emerald-400"
                      : m.role === "assistant"
                      ? "text-cyan-300"
                      : "text-neutral-400"
                  }
                >
                  {m.role}:
                </span>{" "}
                <span className="text-neutral-200">{m.text || "…"}</span>
              </div>
            ))
          ) : (
            <p className="text-neutral-500">No matching transcripts.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
