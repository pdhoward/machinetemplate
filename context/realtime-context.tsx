'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { WebRTCClient } from '@/lib/realtime';
import { toast } from "sonner";
import { getToastParams, getToastParamsFromUnknownError } from "@/lib/toast-errors";

import type { ConversationItem, AgentConfigInput as ClientAgentConfig } from '@/lib/realtime';

/** Align with AgentConfigInput */
export type AgentConfigInput = {
  name?: string;
  instructions?: string;
  tools?: any[];
  voice?: string;
};

export type TurnDetection = any;

export type RealtimeProviderOptions = {
  model?: string;
  defaultVoice?: string;
  appendModelVoiceToUrl?: boolean;
  turnDetection?: TurnDetection;
  /** Initial agent snapshot (optional) */
  initialAgent?: AgentConfigInput;
  /** Max buffered server events */
  maxEventBuffer?: number;
  /** Optional: initial callbacks; can be replaced later via setCallbacks(...) */  
  onServerEvent?: (ev: any) => void;
};

export type RealtimeContextValue = {
  // state
  status: string;
  conversation: ConversationItem[];
  volume: number;
  events: any[];

  // methods (same shape as useWebRTC return)
  connect: (p?: { requestMic?: boolean }) => Promise<void> | void;
  disconnect: () => void;
  sendText: (t: string) => void;
  cancelAssistantSpeech: () => void;
  pttDown: () => void;
  pttUp: () => void;

  // agent/session
  setAgent: (a: AgentConfigInput) => void;
  updateSession: (p: Partial<AgentConfigInput>) => void;

  // tools
  registerFunction: (name: string, fn: (args: any) => Promise<any> | any) => void;

  // unregister tools when tenant switch
  hasFunction: (name: string) => boolean;
  listFunctionNames: () => string[];
  unregisterFunction: (name: string) => boolean;
  unregisterFunctionsByPrefix: (prefix: string, keep?: string[]) => number;

  // mic
  setMicEnabled: (enabled: boolean) => void;
  isMicEnabled: () => boolean;

  // client access + extras
  getClient: () => WebRTCClient;
  forceToolCall: (name: string, args?: any, sayAfter?: string) => void;

  // allow pages to update callbacks later (e.g., bind stageRef.current)
  setCallbacks: (partial: {   
    onServerEvent?: (ev: any) => void;
  }) => void;
};

const RealtimeCtx = createContext<RealtimeContextValue | null>(null);

function extractUsage(ev: any): { text_in: number; text_out: number; audio_in: number; audio_out: number } | null {
  // Common final event names from different releases
  const doneType = new Set(['response.completed', 'response.done', 'response.finish']);
  if (!ev || !doneType.has(ev.type)) return null;

  const u = ev.usage || ev.response?.usage || {};
  const text_in   = Number(u.text_in  ?? u.input_text_tokens   ?? u.input_tokens   ?? u.textIn   ?? 0);
  const text_out  = Number(u.text_out ?? u.output_text_tokens  ?? u.output_tokens  ?? u.textOut  ?? 0);
  const audio_in  = Number(u.audio_in ?? u.input_audio_tokens  ?? u.audioIn        ?? 0);
  const audio_out = Number(u.audio_out?? u.output_audio_tokens ?? u.audioOut       ?? 0);

  const total = text_in + text_out + audio_in + audio_out;
  return total > 0 ? { text_in, text_out, audio_in, audio_out } : null;
}


export function RealtimeProvider({
  children,
  options,
}: {
  children: React.ReactNode;
  options?: RealtimeProviderOptions;
}) {
  const model = options?.model ?? 'gpt-4o-realtime-preview-2024-12-17';
  const defaultVoice = options?.defaultVoice ?? 'alloy';
  const appendModelVoiceToUrl = options?.appendModelVoiceToUrl ?? true;
  const turnDetection = options?.turnDetection;
  const maxEvents = options?.maxEventBuffer ?? 500;

  const clientRef = useRef<WebRTCClient | null>(null);
  
  const heartbeatRef = useRef<number | null>(null);

  // We keep an internal, mutable agent snapshot used by tokenProvider
  const agentRef = useRef<AgentConfigInput>(options?.initialAgent ?? { voice: defaultVoice, tools: [] });

  // public state
  const [status, setStatus] = useState('DISCONNECTED');
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [volume, setVolume] = useState(0);
  const [events, setEvents] = useState<any[]>([]); 

  // wire events buffer + external onServerEvent
  const handleServerEvent = useCallback((ev: any) => {
    setEvents(prev => {
      const next = prev.length >= maxEvents ? prev.slice(1) : prev.slice();
      next.push(ev);
      return next;
    });
    options?.onServerEvent?.(ev);

    // 2) usage accounting (best-effort)
    const u = extractUsage(ev);
    if (u) {
      fetch('/api/usage/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...u,
          sm_session_id: clientRef.current?.getSmSessionId() ?? null,
        }),
      }).catch(() => {});
    }

  }, [options?.onServerEvent, maxEvents]);

  const tokenProvider = useCallback(async () => {
      const agent = agentRef.current || {};
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          model,
          voice: agent.voice ?? defaultVoice,
          instructions: agent.instructions ?? "",
          tools: agent.tools ?? [],
          turn_detection:
            turnDetection ?? {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
              create_response: true,
            },
        }),
      });

      let body: any = null;
      let parseError: Error | null = null;

      try {
        body = await res.json(); // Read body ONLY ONCE here
      } catch (err) {
        parseError = err instanceof Error ? err : new Error(String(err));
      }

      if (parseError) {
        // Handle parse failure (e.g., non-JSON body or network issues)
        const fallbackMsg = 'Failed to parse API response. Please try again.';
        const params = getToastParamsFromUnknownError(parseError); // Or use a custom params
        const toastId = `error_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        toast.error(params.title, { 
          id: toastId, 
          description: params.description || fallbackMsg, 
          duration: 3000, 
          action: {
            label: "Close",
            onClick: () => console.log("Undo"),
          }, 
        });
        throw parseError; // Bubble up to let callers handle (e.g., prevent connection)
      }

      if (!res.ok) {
        // Error path: Use the already-parsed body for detailed toast
        const params = getToastParams(body?.code, body?.userMessage, Number(body?.retryAfter ?? 0), res.status === 429 ? "Please wait a moment and try again." : undefined);
        const toastId = `error_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        toast.error(params.title, { 
          id: toastId, 
          description: params.description, 
          duration: 3000, 
          action: {
            label: "Close",
            onClick: () => console.log("Undo"),
          }, 
        });
        const errorMsg = body?.error || body?.message || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(errorMsg); // Uncommented: Bubble up to prevent proceeding with invalid token
      }

      // Success path: Use the parsed body
      // for heartbeat audit
      clientRef.current?.setSmSessionId?.(body?.sm_session_id ?? null);

      return body.client_secret.value as string; // success path
}, [model, defaultVoice, turnDetection]);

  // Create a single durable client
  if (!clientRef.current) {
    clientRef.current = new WebRTCClient({
      model,
      voice: agentRef.current.voice ?? defaultVoice,
      tokenProvider,
      appendModelVoiceToUrl,
      turnDetection,
      onStatus: setStatus,
      onConversation: setConversation,
      onVolume: setVolume,      
      onServerEvent: handleServerEvent,            // wrapped buffer
    });

    // Expose to window for registry/debug (SSR-safe internally)
    clientRef.current.exposeRegistryToWindow();
  }

  // --- stable client getter ---
  const getClient = useCallback(() => clientRef.current!, []);

  // --- stable methods (do NOT depend on changing state) ---
  const connect = useCallback(async (p?: { requestMic?: boolean }) => {
        try {
          await getClient().connect(p);
        } catch (err) {
          const params = getToastParamsFromUnknownError(err);
          const toastId = `connect_error_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          toast.error(params.title, { 
            id: toastId, 
            description: params.description, 
            duration: 3000, 
            action: {
                label: "Close",
                onClick: () => console.log("Undo"),
            }
          });
        }
      },
      [getClient]   
    );

  const disconnect            = useCallback(() => getClient().disconnect(), [getClient]);
  const sendText              = useCallback((t: string) => getClient().sendText(t), [getClient]);
  const cancelAssistantSpeech = useCallback(() => getClient().cancelAssistantSpeech(), [getClient]);
  const pttDown               = useCallback(() => getClient().pttDown(), [getClient]);
  const pttUp                 = useCallback(() => getClient().pttUp(), [getClient]);

  const setAgentCb = useCallback((a: AgentConfigInput) => {
    agentRef.current = { ...agentRef.current, ...a };
    const c = getClient();
    c.setAgent(agentRef.current as ClientAgentConfig);
    c.updateSession({});
  }, [getClient]);

  const updateSessionCb = useCallback((p: Partial<AgentConfigInput>) => {
    agentRef.current = { ...agentRef.current, ...p };
    getClient().updateSession(p as Partial<ClientAgentConfig>);
  }, [getClient]);

  const registerFunctionCb = useCallback((name: string, fn: (args: any) => Promise<any> | any) => {
    getClient().registerFunction(name, fn);
  }, [getClient]);

  // unregister helpers
  const hasFunctionCb = useCallback((name: string) => getClient().hasFunction(name), [getClient]);
  const listFunctionNamesCb = useCallback(() => getClient().listFunctionNames(), [getClient]);
  const unregisterFunctionCb = useCallback((name: string) => getClient().unregisterFunction(name), [getClient]);
  const unregisterByPrefixCb = useCallback(
    (prefix: string, keep: string[] = []) => getClient().unregisterFunctionsByPrefix(prefix, keep),
    [getClient]
  );

  // mic + extras
  const setMicEnabledCb = useCallback((enabled: boolean) => getClient().setMicEnabled(enabled), [getClient]);
  const isMicEnabledCb  = useCallback(() => getClient().isMicEnabled(), [getClient]);
  const forceToolCallCb = useCallback(
    (name: string, args?: any, sayAfter?: string) => getClient().forceToolCall(name, args, sayAfter),
    [getClient]
  );

  const setCallbacksCb = useCallback((partial: {
    onShowComponent?: (name: string) => void;
    onServerEvent?: (ev: any) => void;
  }) => {
    getClient().setCallbacks(partial);
  }, [getClient]);

  // Keep callbacks fresh if provider options change
  useEffect(() => {
    clientRef.current?.setCallbacks({     
      onServerEvent: handleServerEvent,
    });
  }, [handleServerEvent]);

  // Also bridge to window here to fight HMR/global loss
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const c = clientRef.current!;
      (window as any).realtime = c;
      (window as any).getToolRegistrySnapshot = () => c.getFunctionRegistrySnapshot?.();
      (window as any).__OPENAI_TOOL_REGISTRY = (window as any).__OPENAI_TOOL_REGISTRY ?? {};
    }
  }, []);

  // heartbeat
  useEffect(() => {
    if (status === 'CONNECTED') {
      // start
      const run = () => {
        const id = clientRef.current?.getSmSessionId();
        if (!id) return; // no session id yet
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sm_session_id: id }),
        }).catch(() => {});
      };
      run(); // send one immediately
      heartbeatRef.current = window.setInterval(run, 45_000); // every 45s
    } else {
      // stop
      if (heartbeatRef.current != null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }
    return () => {
      if (heartbeatRef.current != null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [status]);

  // Public API (mirrors your useWebRTC)
  const api = useMemo<RealtimeContextValue>(() => ({
    
    status,
    conversation,
    volume,
    events,

    // stable methods
    connect,
    disconnect,
    sendText,
    cancelAssistantSpeech,
    pttDown,
    pttUp,

    setAgent: setAgentCb,
    updateSession: updateSessionCb,

    registerFunction: registerFunctionCb,

    hasFunction: hasFunctionCb,
    listFunctionNames: listFunctionNamesCb,
    unregisterFunction: unregisterFunctionCb,
    unregisterFunctionsByPrefix: unregisterByPrefixCb,

    setMicEnabled: setMicEnabledCb,
    isMicEnabled: isMicEnabledCb,

    getClient,           // stable getter
    forceToolCall: forceToolCallCb,

    setCallbacks: setCallbacksCb,
  }), [
    // include state so subscribers re-render with new state values,
    // but the method identities remain stable by levering useCallback above.
    status, conversation, volume, events,

    // include the stable callbacks themselves 
    connect, disconnect, sendText, cancelAssistantSpeech, pttDown, pttUp,
    setAgentCb, updateSessionCb, registerFunctionCb,
    hasFunctionCb, listFunctionNamesCb, unregisterFunctionCb, unregisterByPrefixCb,
    setMicEnabledCb, isMicEnabledCb, getClient, forceToolCallCb, setCallbacksCb,
  ]);


  return <RealtimeCtx.Provider value={api}>{children}</RealtimeCtx.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeCtx);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}
