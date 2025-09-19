"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { tools as builtinTools } from "@/lib/basictools";
import { useRealtime } from '@/context/realtime-context';
//import { useWebRTC } from "@/hooks/useWebRTC";
import Visualizer from "@/components/visualizer";
import VisualStageHost, { VisualStageHandle } from "@/components/visual-stage-host";
import ControlsBar from "@/components/control-bar";
import {
  VoiceDialogTrigger,
  LogsDialogTrigger,
  TranscriptDialogTrigger,
  UsageDialogTrigger,
  SelfTestDialogTrigger
} from "@/components/triggers";

import { Send } from "lucide-react"; 
import { motion } from "framer-motion";
import { useToolsFunctions } from "@/hooks/use-tools";
import {Diagnostics} from "@/components/diagnostics"

import { loadAndRegisterTenantActions } from "@/lib/agent/registerActions";

import { useTenant } from "@/context/tenant-context";
import { actionToolName } from "@/lib/agent/helper";
import type {ToolDef} from "@/types/tools"
import { coreTools } from "@/types/tools";  // 

import { ThingArraySchema } from "@/types/things.schema";
import { toThingView } from "@/lib/things/view";

import prompts from "@/promptlibrary/prompts.json"
import { selectPromptForTenant } from "@/lib/agent/prompts";
 

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

// ---------- page ----------
const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true); // for the close “×” button
  const [inputText, setInputText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [timer, setTimer] = useState<number>(0);
  const [componentName, setComponentName] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false); 

  const agentTools = useMemo(() => [...defaultTools, ...builtinTools], []);

  const toolsFunctions = useToolsFunctions(); ///set of locally defined tools in hook
  
  const { tenantId } = useTenant();
  // anchor for the visualizer card
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // anchor for the visual components
  const stageRef = useRef<VisualStageHandle>(null)

  // tenantId available:
  const { name: agentName, instructions: SYSTEM_PROMPT } =
      selectPromptForTenant(tenantId ?? "unknown-tenant", prompts);

 /*
  Wrap the stageRef with a stable function and use that in Registering 
  Tenant scoped actions
 */
  const showOnStage = useCallback((args: any) => {
    stageRef.current?.show?.(args);
  }, []);

  const hideStage = useCallback(() => {
  stageRef.current?.hide?.();
}, []);

  const {
    status, 
    conversation, 
    volume, 
    events,
    connect, 
    disconnect, 
    sendText, 
    pttDown, 
    pttUp,
    setAgent, 
    updateSession, 
    registerFunction,    
    unregisterFunctionsByPrefix,   // clear out functions when new tenant detected
    setMicEnabled,
    forceToolCall,
    setCallbacks, 
    getClient,
  } = useRealtime();
  
   // Bind callbacks that depend on local refs/state
  useEffect(() => {
    setCallbacks({
      onShowComponent: (name: string) => {
        stageRef.current?.show?.({ component_name: name });
      },
    });
  }, [setCallbacks]);

  // Push initial agent config (and whenever it changes)
  useEffect(() => {
    const agent = {
      name: tenantId,
      voice,
      instructions: SYSTEM_PROMPT,
      tools: coreTools,
    };
    setAgent(agent);
    updateSession(agent); // safe; pushes to live session if connected
  }, [voice, setAgent, updateSession]);

    // register the local set of tools once
    useEffect(() => {
      console.log("[App] tools registration effect START");
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
          console.log("[App] registerFunction:", toolName, "from localName:", localName);
          registerFunction(toolName, fn);
        } else {
          console.log("[App] skip localName:", localName, "->", toolName, "fn type:", typeof fn);
        }
      });

       // register the visual helper tool
       console.log("[App] registerFunction: show_component");
       registerFunction("show_component", async (args: any) => {
          // args can be { component_name, title?, description?, size?, props?, media?, url? }
          stageRef.current?.show(args);
          return { ok: true };
      });       

        // list_things
        console.log("[App] registerFunction: list_things");
        registerFunction("list_things", async ({ type, q, limit }: { type?: string; q?: string; limit?: number }) => {
            const params = new URLSearchParams();
            if (type) params.set("type", type);
            if (q) params.set("q", q);
            if (limit) params.set("limit", String(limit));

            const r = await fetch(`/api/things/${tenantId}?${params.toString()}`, { cache: "no-store" });
            if (!r.ok) {
              return { ok: false, error: `HTTP ${r.status}` };
            }

            const json = await r.json();

            // Validate on the client (optional but nice)
            const parse = ThingArraySchema.safeParse(json);
            if (!parse.success) {
              console.warn("[list_things] schema mismatch:", parse.error.issues);
              // still return raw if you prefer:
              return { ok: true, data: json };
            }

            // Option A: return raw docs (model can “speak” any field)
            // return { ok: true, data: parse.data };

            // Option B: return normalized views so the model/UI has a predictable shape
            const views = parse.data.map(toThingView);
            return { ok: true, data: views };
          });             

        console.log("[App] CORE tools registration effect END");
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);   

     //   ✅ 2) Tenant-scoped action tools are reloaded with change in Tenant
      useEffect(() => {
        if (!tenantId) return;
        console.log("[App] registerFunction: execute_action ");
        unregisterFunctionsByPrefix('action_');

        (async () => {
          await loadAndRegisterTenantActions({
            tenantId,
            coreTools,
            systemPrompt: SYSTEM_PROMPT,
            registerFunction,     // from useWebRTC
            updateSession,        // from useWebRTC
            showOnStage,          // 👈 passing a stable function, rather than stageRef
            hideStage,            // 👈 optional
            maxTools: 80,         // headroom under 128
            preclear: {
              prefix: "action.",
              unregisterByPrefix: (prefix, keep) => unregisterFunctionsByPrefix(prefix, keep),
              // keep: ['action.shared_healthcheck'] // if you want to keep some
            },
          });

          // Let /registry refresh
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tool-registry-updated"));
          }
        })();
      }, [tenantId, registerFunction, updateSession, showOnStage, hideStage, unregisterFunctionsByPrefix]);

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

  // function passed to the transcript trigger
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


    {/* Centered stage */}
    <div className="mt-20 p-4 flex-1 p-4 flex items-center justify-center">
      {/* iPhone shell */}
      <motion.div
        className="relative flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="relative w-[240px] h-[480px] bg-neutral-900 rounded-[32px] border-2 border-neutral-800 shadow-xl overflow-hidden">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-neutral-800 rounded-b-lg z-10" />
          <div className="absolute top-6 bottom-0 left-0 right-0 flex flex-col">
            {/* top content */}
            <div className="flex-1 p-3">
              <div className="h-full flex flex-col text-neutral-200">
                <div className="flex justify-between items-center mb-2 px-3">
                  <h3 className="text-sm font-semibold">Cypress Resorts</h3>
                  <span className="text-xs">{formatTime(timer)}</span>
                </div>

                {/* card: compact, stationary (visualizer + small input) */}
                <div className="flex-1 mb-4 max-w-full box-sizing-border-box">
                  <motion.div
                    className="w-full max-w-md bg-neutral-900/70 text-card-foreground rounded-xl border border-neutral-800 shadow-sm p-4 space-y-3"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
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
                        placeholder={
                          isConnected
                            ? "Type a quick message…"
                            : "Connect to send messages"
                        }
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

                  {/* Stationary anchor; no transcript scroll here */}
                  <div ref={messagesEndRef} />
                </div>

                {isConnected && (
                  <div className="text-xs text-neutral-400 text-center p-2">
                    Status: Open
                  </div>
                )}
              </div>
            </div>

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
                    forceToolCall={forceToolCall}
                    getEventsCount={() => events.length}
                    mockShowComponent={(name) => setComponentName(name)}
                  />
                }
              />
            </div>
          </div>

          {/* close X for overlay */}
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

    {/* Visual stage host (lives once at page root) */}
    <VisualStageHost ref={stageRef} />

    {/* Diagnostics (keep outside the phone; position as you prefer) */}
    <Diagnostics status={status} volume={volume} events={events} getClient={getClient} />
  </motion.div>
);


};

export default App;
