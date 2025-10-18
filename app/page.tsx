"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { useRealtime } from '@/context/realtime-context';
import { useTenant } from "@/context/tenant-context";

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
import { useVisualFunctions } from "@/hooks/use-visuals";
import { useTranscriptSink } from "@/hooks/use-transcript-sink";

import {Diagnostics} from "@/components/diagnostics"

import { fetchTenantHttpTools } from "@/lib/registry/fetchTenantTools";

import { registerHttpToolsForTenant } from "@/lib/agent/registerTenantHttpTools";
import type {ToolDef} from "@/types/tools"
import { coreTools } from "@/types/tools";  

import promptsJson from "@/promptlibrary/prompts.json"
import { selectPromptForTenant, buildInstructions } from "@/lib/agent/prompts";
import type { StructuredPrompt } from "@/types/prompt";
 
// ---------- page ----------
const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true); // for the close “×” button
  const [inputText, setInputText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [timer, setTimer] = useState<number>(0);
  const [componentName, setComponentName] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);   
  
  const { tenantId } = useTenant();
  // anchor for the visualizer card
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // anchor for the visual components
  const stageRef = useRef<VisualStageHandle | null>(null);
  
  const toolsFunctions = useToolsFunctions(); //locally defined utility tools in hook
  const visualFunction = useVisualFunctions({stageRef}); //locally defined visual UI tool in hook
  

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
  
    // transcript conversation hook to post transcripts to mongo
    useTranscriptSink(conversation as any);

    // capture transcripts to mongo when browser closed or tab hidden
    useEffect(() => {
      const finalize = () => {
        // Fire-and-forget; sendBeacon-friendly if you want
        navigator.sendBeacon?.(
          "/api/transcripts/finalize",
          new Blob([], { type: "application/json" })
        );
      };

      // Most reliable on mobile/Safari
      const onPageHide = () => finalize();

      // Fallback when tab becomes hidden
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") finalize();
      };

      window.addEventListener("pagehide", onPageHide, { capture: true });
      document.addEventListener("visibilitychange", onVisibilityChange);

      return () => {
        window.removeEventListener("pagehide", onPageHide, { capture: true } as any);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }, []);

   
    // Push initial agent config and whenever it changes
     useEffect(() => {
      setAgent({ name: tenantId, voice }); // tool instructions handled below
    }, [tenantId, voice, setAgent]);

    // register the local set of tools once
    useEffect(() => {
      console.log("[App] tools registration effect START");

      // localName for Toolbox functions -> tool name in the model schema
      const nameMap: Record<string, string> = {
        timeFunction: "getCurrentTime",
        backgroundFunction: "changeBackgroundColor",
        partyFunction: "partyMode",
        launchWebsite: "launchWebsite",
        copyToClipboard: "copyToClipboard",
        scrapeWebsite: "scrapeWebsite",
        visualFunction: "show_component"
        //expose more tools as needed
      };

      // register utility toolbox functions
      Object.entries(toolsFunctions).forEach(([localName, fn]) => {
        const toolName = nameMap[localName];
        if (toolName && typeof fn === "function") {
          console.log("[App] registerFunction:", toolName, "from localName:", localName);
          registerFunction(toolName, fn);
        } else {
          console.log("[App] skip localName:", localName, "->", toolName, "fn type:", typeof fn);
        }
      });

      // register visual UI function = show_component
      Object.entries(visualFunction).forEach(([localName, fn]) => {
        const toolName = nameMap[localName];
        if (toolName && typeof fn === "function") {
          console.log("[App] registerFunction:", toolName, "from localName:", localName);
          registerFunction(toolName, fn);
        } else {
          console.log("[App] skip localName:", localName, "->", toolName, "fn type:", typeof fn);
        }
      });      

        console.log("[App] CORE tools registration effect END");
         // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);   

       // ✅ 2) Tenant-scoped action tools are reloaded with change in Tenant
        useEffect(() => {
          if (!tenantId) return;

          (async () => {
            // 1) Clear tenant-scoped tools by namespace(s)          
            unregisterFunctionsByPrefix("http_"); // if you name http tools with a prefix (optional)            

            // 2) Register HTTP tools + get their ToolDefs
            const httpToolDefs = await registerHttpToolsForTenant({
              tenantId,
              registerFunction,
              showOnStage,
              hideStage,
              cap: 64, // budget under the model cap
              fetchDescriptors: async () => {
                const rows = await fetchTenantHttpTools(tenantId);              
                // only returns 'http_tool'
                return rows
              },
            });

            // 3) Build instructions once (tenant prompt + all exposed tools)
            const { name: agentName, base } = selectPromptForTenant(
              tenantId,
              promptsJson as StructuredPrompt | StructuredPrompt[]
            );
            const exposedToolDefs: ToolDef[] = [
              ...coreTools,            
              ...httpToolDefs,
            ];
            const todayIso = new Date().toISOString();
            const SYSTEM_PROMPT = [
              `TODAY_IS: ${todayIso} (use America/Chicago for local comparisons)`,
              buildInstructions(base, exposedToolDefs)
            ].join("\n\n");         

            // 4) Single session update
            updateSession({ tools: exposedToolDefs, instructions: SYSTEM_PROMPT });

            window.dispatchEvent(new CustomEvent("tool-registry-updated"));
          })();
        }, [
          tenantId,
          coreTools,
          registerFunction,
          updateSession,          
          unregisterFunctionsByPrefix,
        ]);


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
  const onEndCall = async () => {
    try {
      await fetch("/api/transcripts/finalize", { method: "POST" });
    } catch {}
    disconnect();
  };
  const onEndSession = onEndCall; 

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
    className="fixed inset-0 bg-black bg-opacity-50 z-40 flex flex-col"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >  


    {/* Centered stage */}
    <div className="mt-20 p-4 flex-1 flex items-center justify-center">
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
