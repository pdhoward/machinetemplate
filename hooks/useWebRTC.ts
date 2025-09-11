"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { WebRTCClient } from "@/lib/realtime";
import type { ConversationItem } from "@/lib/realtime";

export interface AgentConfigInput {
  name?: string;
  instructions?: string;
  tools?: any[];
  voice?: string;
}

interface UseWebRTCOptions {
  model?: string;
  defaultVoice?: string;
  getAgent: () => AgentConfigInput;
  appendModelVoiceToUrl?: boolean;
  turnDetection?: any;
  onShowComponent?: (name: string) => void; 
  // You can still pass one in; we’ll also capture internally to `events`
  onServerEvent?: (ev: any) => void;
  // Optional: how many events to keep (defaults to 500)
  maxEventBuffer?: number;
}

interface UseWebRTCReturn {
  status: string;
  conversation: ConversationItem[];
  volume: number;
  events: any[];
  connect: (p?: { requestMic?: boolean }) => Promise<void> | void;
  disconnect: () => void;
  sendText: (t: string) => void;
  cancelAssistantSpeech: () => void;
  pttDown: () => void;
  pttUp: () => void;
  setAgent: (a: AgentConfigInput) => void;
  updateSession: (p: Partial<AgentConfigInput>) => void;
  registerFunction: (name: string, fn: (args: any) => Promise<any> | any) => void;
  setMicEnabled: (enabled: boolean) => void;
  isMicEnabled: () => boolean;
  getClient: () => WebRTCClient;
  forceToolCall: (name: string, args?: any, sayAfter?: string) => void;
}

export function useWebRTC(opts: UseWebRTCOptions): UseWebRTCReturn {
  const clientRef = useRef<WebRTCClient | null>(null);

  const [status, setStatus] = useState("DISCONNECTED");
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [volume, setVolume] = useState(0);
  const [events, setEvents] = useState<any[]>([]);

  const maxEvents = opts.maxEventBuffer ?? 500;

   // token provider posts latest agent config to /api/session
  const tokenProvider = useCallback(async () => {
    const agent = opts.getAgent?.() ?? {};
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? "gpt-4o-realtime-preview-2024-12-17",
        voice: agent.voice ?? opts.defaultVoice ?? "alloy",
        instructions: agent.instructions, // includes the system prompt from main page
        tools: agent.tools ?? [],
        turn_detection:
          opts.turnDetection ?? {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true,
          },
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "session error");
    return j.client_secret.value as string;
  }, [opts]);

  // wrapper to both forward and buffer events
  const handleServerEvent = useCallback((ev: any) => {
    setEvents((prev) => {
      const next = prev.length >= maxEvents ? prev.slice(1) : prev.slice();
      next.push(ev);
      return next;
    });
    opts.onServerEvent?.(ev);
  }, [opts, maxEvents]);
  
  if (!clientRef.current) {
    clientRef.current = new WebRTCClient({
      model: opts.model ?? "gpt-4o-realtime-preview-2024-12-17",
      voice: opts.defaultVoice ?? "alloy",
      tokenProvider,
      appendModelVoiceToUrl: opts.appendModelVoiceToUrl ?? true,
      turnDetection: opts.turnDetection,
      onStatus: setStatus,
      onConversation: setConversation,
      onVolume: setVolume,
      onShowComponent: opts.onShowComponent,
      onServerEvent: handleServerEvent,
    });

    // Debug (safe): does the method exist?
    // DO NOT touch `window` here.
    // @ts-ignore
    console.log("[useWebRTC] client created. exposeRegistryToWindow? =", typeof clientRef.current.exposeRegistryToWindow);

    // Safe to call; it internally guards `window`
    clientRef.current.exposeRegistryToWindow();
  }

  // Keep callbacks fresh (ALWAYS top-level; never conditional)
  useEffect(() => {
    clientRef.current?.setCallbacks({
      onShowComponent: opts.onShowComponent,
      onServerEvent: handleServerEvent,
    });
  }, [opts.onShowComponent, handleServerEvent]);

  // ---------- Put ALL window access inside an effect ----------
  useEffect(() => {
    if (typeof window !== "undefined") {
      // @ts-ignore
      console.log("[useWebRTC] window.getToolRegistrySnapshot exists? =", typeof window.getToolRegistrySnapshot);

      // Optional debug helper
      (window as any).__dumpToolSnapshot = () => {
        // @ts-ignore
        const snap = window.getToolRegistrySnapshot?.();
        console.log("[useWebRTC] __dumpToolSnapshot:", snap ? Object.keys(snap) : snap);
        return snap;
      };
    } else {
      console.log("[useWebRTC] window not available yet (SSR)");
    }
  }, []); // run once after mount

  const api = useMemo(() => {
    const c = clientRef.current!;
    return {
      connect: (p?: { requestMic?: boolean }) => c.connect(p),
      disconnect: () => c.disconnect(),
      sendText: (t: string) => c.sendText(t),
      cancelAssistantSpeech: () => c.cancelAssistantSpeech(),
      pttDown: () => c.pttDown(),
      pttUp: () => c.pttUp(),
      setAgent: (a: AgentConfigInput) => c.setAgent(a),
      updateSession: (p: Partial<AgentConfigInput>) => c.updateSession(p),
      registerFunction: (name: string, fn: (args: any) => Promise<any> | any) => c.registerFunction(name, fn),
      setMicEnabled: (enabled: boolean) => c.setMicEnabled(enabled),
      isMicEnabled: () => c.isMicEnabled(),
      getClient: () => c,
      forceToolCall: (name: string, args?: any, sayAfter?: string) => c.forceToolCall(name, args, sayAfter),
    };
  }, []);

  return { status, conversation, volume, events, ...api };
}
