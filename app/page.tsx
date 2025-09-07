"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { tools as builtinTools } from "@/lib/tools";
import { useWebRTC } from "@/hooks/useWebRTC";
import Visualizer from "@/components/visualizer";
import ControlsBar from "@/components/control-bar";
import {
  VoiceDialogTrigger,
  LogsDialogTrigger,
  TranscriptDialogTrigger,
  UsageDialogTrigger,
  SelfTestDialogTrigger
} from "@/components/triggers";

import TranscriptPanel from "@/components/transcript-panel";
import { Send } from "lucide-react"; // you already import some

import { motion } from "framer-motion";
import { useToolsFunctions } from "@/hooks/use-tools";
import {Diagnostics} from "@/components/diagnostics"
 
type ToolDef = {
  type: "function";                   
  name: string;
  description: string;
  parameters?: any;                  
};

// --- tool schema you expose to the model ---
const defaultTools: ToolDef[] = [
  {
    type: "function",
    name: "show_component",
    description: "Show UI component (image/video/panel) by name.",
    parameters: {
      type: "object",
      properties: { component_name: { type: "string", description: "Component key to display" } },
      required: ["component_name"],
      additionalProperties: false,
    },
  },
];

// ---------- helpers for logs ----------
type MessageLog = {
  id: string;
  role?: "user" | "assistant" | "system";
  text?: string;
  timestamp: number;
  type?: string;
  data?: { text?: string };
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

function eventsToMessageLogs(events: any[]): MessageLog[] {
  return events.map((ev, i) => ({
    id: String(ev?.item?.id ?? ev?.item_id ?? i),
    role: ev?.item?.role,
    text: ev?.item?.content?.[0]?.text || ev?.delta || "",
    timestamp: Date.now(),
    type: ev?.type,
    data: { text: summarizeEvent(ev) },
  }));
}

// ---------- page ----------
const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true); // for the close “×” button
  const [inputText, setInputText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [timer, setTimer] = useState<number>(0);
  const [componentName, setComponentName] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");

  const agentTools = useMemo(() => [...defaultTools, ...builtinTools], []);

  const toolsFunctions = useToolsFunctions(); ///set of locally defined tools in hook
  
  const [agent, setAgentState] = useState({
    name: "General",
    voice: "alloy",
    instructions: "You are a helpful assistant.",
    tools: agentTools,
  });

  // logs dialog
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Auto-scroll ref for message list
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    status,
    conversation,
    volume,
    events, // raw server events (for logs + analytics)
    connect,
    disconnect,
    sendText,
    pttDown,
    pttUp,
    setAgent,
    updateSession,
    registerFunction,
    setMicEnabled,     // from hook (tiny wrapper to client.setMicEnabled)
    isMicEnabled,      // from hook (tiny wrapper to client.isMicEnabled)
    getClient,
    forceToolCall
  } = useWebRTC({    
    model: "gpt-realtime",
    defaultVoice: "alloy",
    appendModelVoiceToUrl: true, // set false for server-only config
    getAgent: () => agent,
    onShowComponent: (name) => setComponentName(name),    
  });

  const filteredTranscripts = useMemo(() => {
    const q = transcriptSearchQuery.trim().toLowerCase();
    const list = Array.isArray(conversation) ? conversation : [];
    if (!q) return list.slice(-200); // keep it light
    return list
      .filter((m) => {
        const text = (m.text || "").toLowerCase();
        const role = (m.role || "").toLowerCase();
        return text.includes(q) || role.includes(q);
      })
      .slice(-200);
  }, [conversation, transcriptSearchQuery]);
 

    // register the ,cal set of tools everything once
    useEffect(() => {
      // localName (your hook keys) -> tool name in the model schema
      const nameMap: Record<string, string> = {
        timeFunction: "getCurrentTime",
        backgroundFunction: "changeBackgroundColor",
        partyFunction: "partyMode",
        launchWebsite: "launchWebsite",
        copyToClipboard: "copyToClipboard",
        scrapeWebsite: "scrapeWebsite",
        //expose more tools as needed
      };

      // register toolbox functions
      Object.entries(toolsFunctions).forEach(([localName, fn]) => {
        const toolName = nameMap[localName];
        if (toolName && typeof fn === "function") {
          registerFunction(toolName, fn);
        }
      });

      // register the visual helper tool
      registerFunction("show_component", async ({ component_name }) => {
        setComponentName(component_name);
        return { ok: true, shown: component_name };
      });
    }, [registerFunction, toolsFunctions]); 


  // Keep agent voice in sync with selector
  useEffect(() => {
    const next = { ...agent, voice };
    setAgentState(next);
    setAgent(next);
    updateSession({ voice }); // push to live session if connected
  }, [voice]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer based on connection status
  useEffect(() => {
    let id: NodeJS.Timeout | null = null;
    if (status === "CONNECTED") {
      id = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [status]);

  // Auto-scroll on new conversation items
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const isConnected = status === "CONNECTED";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Mute/unmute mic
  const onMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setMicEnabled?.(!next);
  };

  const onStartCall = () => connect();
  const onEndCall = () => disconnect();
  const onEndSession = () => disconnect();  

  const onToggleTranscription = () => setTranscriptOpen((v) => !v);

  // Build logs on demand from `events`
  const messageLogs: MessageLog[] = useMemo(
    () => eventsToMessageLogs(events),
    [events]
  );
  const filteredLogs = useMemo(() => {
    const q = logSearchQuery.trim().toLowerCase();
    if (!q) return messageLogs;
    return messageLogs.filter((l) =>
      (l.data?.text ?? "").toLowerCase().includes(q)
    );
  }, [messageLogs, logSearchQuery]);

  const downloadTranscription = () => {
    const content = conversation
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleString()}] ${m.role}: ${m.text}`
      )
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

return (
  <motion.div
    className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <header className="bg-gradient-to-r from-neutral-800 to-neutral-700 p-4 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-neutral-200">
          Cypress Resorts
        </h1>
      </div>
      <span className="text-sm text-neutral-400">Luxury Awaits</span>
    </header>

    <div className="flex-1 flex flex-col md:flex-row gap-4 p-4">
      {/* iPhone shell */}
      <div className="md:w-1/3 flex justify-center items-center">
        <motion.div
          className="relative flex items-center justify-center w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative w-[240px] h-[480px] bg-neutral-900 rounded-[32px] border-2 border-neutral-800 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-neutral-800 rounded-b-lg z-10" />
            <div className="absolute top-6 bottom-0 left-0 right-0 flex flex-col">
              {/* top content */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="h-full flex flex-col text-neutral-200">
                  <div className="flex justify-between items-center mb-2 px-3">
                    <h3 className="text-sm font-semibold">Cypress Resorts</h3>
                    <span className="text-xs">{formatTime(timer)}</span>
                  </div>
                    {/* card: compact, stationary (visualizer + small input) */}
                    <div className="flex-1 mb-4 max-w-full box-sizing-border-box">
                      <motion.div
                        className="w-full max-w-md bg-neutral-850/60 text-card-foreground rounded-xl border border-neutral-800 shadow-sm p-4 space-y-3"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                      >                       

                        {/* Visualizer (always visible so it can show the green “Phone” to connect) */}
                        <Visualizer
                          volume={volume}
                          isConnected={isConnected}
                          onStart={onStartCall}
                          onEnd={onEndCall}
                        />

                      {/* Compact input (tiny, no scroll) */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const text = inputText.trim();
                          if (!text) return;
                          sendText(text);
                          setInputText("");
                        }}
                        className="mt-1 flex items-center gap-2"
                      >
                        <input
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder={isConnected ? "Type a quick message…" : "Connect to send messages"}
                          disabled={!isConnected}
                          className="flex-1 text-[11px] leading-[1.1rem] bg-neutral-800 text-neutral-200 placeholder-neutral-500 rounded-lg border border-neutral-700 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-60"
                        />
                        <button
                          type="submit"
                          disabled={!isConnected || !inputText.trim()}
                          className="inline-flex items-center justify-center rounded-md bg-neutral-600 hover:bg-neutral-500 disabled:opacity-50 text-white h-7 px-2"
                          title="Send"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </motion.div>

                    {/* Stationary; we keep the anchor but no overflow in the card */}
                    <div ref={messagesEndRef} />
                  </div>              

                  {isConnected && (
                    <div className="text-xs text-neutral-400 text-center p-2">
                      Status: Open
                    </div>
                  )}
                </div>
              </div>

              {/* slide-up transcript overlay */}
              <TranscriptPanel open={transcriptOpen} conversation={conversation as any} />

           {/* bottom controls (compact) */}
           <div className="p-3 border-t border-neutral-800">
            <ControlsBar
              isConnected={isConnected}
              isMuted={isMuted}
              onMute={onMute}
              onStartCall={onStartCall}
              onEndCall={onEndCall}
              voiceTrigger={<VoiceDialogTrigger value={voice} onChange={setVoice} />}
              logsTrigger={<LogsDialogTrigger events={events} />}
              transcriptTrigger={
                <TranscriptDialogTrigger
                  conversation={conversation as any}
                  onDownload={downloadTranscription}
                />
              }
              usageTrigger={<UsageDialogTrigger events={events} />}
              selfTest={               
                <SelfTestDialogTrigger
                  status={status}
                  isConnected={isConnected}
                  connect={connect}
                  disconnect={disconnect}
                  sendText={sendText}
                  conversation={conversation}
                  componentName={componentName}
                  events={events}
                  forceToolCall={forceToolCall}                 // from useWebRTC
                  getEventsCount={() => events.length}          // live counter for logs check
                  mockShowComponent={(name) => setComponentName(name)}
                />
              }
            />
          </div>

           
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 text-neutral-400 text-sm"
              title="Close"
            >
              ×
            </button>
          </div>
        </motion.div>
      </div>

      {/* right side area could render componentName previews, etc. */}
      <div className="md:flex-1 hidden md:block border border-neutral-800 rounded-xl p-4 text-neutral-300">
        <div className="text-xs uppercase opacity-60 mb-2">Component request</div>
        <div className="font-mono text-emerald-400">{componentName ?? "—"}</div>
        {/* Render your image/video/etc based on componentName here */}
      </div>

      <Diagnostics status={status} volume={volume} events={events} getClient={getClient} />
    </div>
  </motion.div>
);

};

export default App;
