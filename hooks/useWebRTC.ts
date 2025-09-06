// hooks/useWebRTC.ts
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { WebRTCClient } from "@/lib/realtime";

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
  onFunctionCall?: (call: any) => void;
  // You can still pass one in; we’ll also capture internally to `events`
  onServerEvent?: (ev: any) => void;
  // Optional: how many events to keep (defaults to 500)
  maxEventBuffer?: number;
}

export function useWebRTC(opts: UseWebRTCOptions) {
  const clientRef = useRef<WebRTCClient | null>(null);

  const [status, setStatus] = useState("DISCONNECTED");
  const [conversation, setConversation] = useState<any[]>([]);
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
        instructions: agent.instructions ?? "Be helpful and concise.",
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
      onFunctionCall: opts.onFunctionCall,
      onServerEvent: handleServerEvent, // <-- buffer into `events`
    });
  }

  // keep callbacks fresh
  useEffect(() => {
    clientRef.current?.setCallbacks({
      onShowComponent: opts.onShowComponent,
      onFunctionCall: opts.onFunctionCall,
      onServerEvent: handleServerEvent,
    });
  }, [opts.onShowComponent, opts.onFunctionCall, handleServerEvent]);

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
      // NEW: mic control + access to client
      setMicEnabled: (enabled: boolean) => c.setMicEnabled(enabled),
      isMicEnabled: () => c.isMicEnabled(),
      getClient: () => c,
    };
  }, []);

  // return `events` so it can replace your old `msgs`
  return { status, conversation, volume, events, ...api };
}
