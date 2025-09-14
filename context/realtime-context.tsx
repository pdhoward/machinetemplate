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
  onShowComponent?: (name: string) => void;
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
    onShowComponent?: (name: string) => void;
    onServerEvent?: (ev: any) => void;
  }) => void;
};

const RealtimeCtx = createContext<RealtimeContextValue | null>(null);

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
  }, [options?.onServerEvent, maxEvents]);

  // Build token provider that posts the *latest* agent snapshot
  const tokenProvider = useCallback(async () => {
    const agent = agentRef.current || {};
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        voice: agent.voice ?? defaultVoice,
        instructions: agent.instructions ?? '',
        tools: agent.tools ?? [],
        turn_detection:
          turnDetection ?? {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200,
            create_response: true,
          },
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'session error');
    return j.client_secret.value as string;
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
      onShowComponent: options?.onShowComponent,   // can be replaced via setCallbacks
      onServerEvent: handleServerEvent,            // wrapped buffer
    });

    // Expose to window for registry/debug (SSR-safe internally)
    clientRef.current.exposeRegistryToWindow();
  }

  // Keep callbacks fresh if provider options change
  useEffect(() => {
    clientRef.current?.setCallbacks({
      onShowComponent: options?.onShowComponent,
      onServerEvent: handleServerEvent,
    });
  }, [options?.onShowComponent, handleServerEvent]);

  // Also bridge to window here to fight HMR/global loss
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const c = clientRef.current!;
      (window as any).realtime = c;
      (window as any).getToolRegistrySnapshot = () => c.getFunctionRegistrySnapshot?.();
      (window as any).__OPENAI_TOOL_REGISTRY = (window as any).__OPENAI_TOOL_REGISTRY ?? {};
    }
  }, []);

  // Public API (mirrors your useWebRTC)
  const api = useMemo<RealtimeContextValue>(() => {
    const c = clientRef.current!;
    return {
      status,
      conversation,
      volume,
      events,

      connect: (p?: { requestMic?: boolean }) => c.connect(p),
      disconnect: () => c.disconnect(),
      sendText: (t: string) => c.sendText(t),
      cancelAssistantSpeech: () => c.cancelAssistantSpeech(),
      pttDown: () => c.pttDown(),
      pttUp: () => c.pttUp(),

      setAgent: (a: AgentConfigInput) => {
        // update local agent snapshot then push to client
        agentRef.current = { ...agentRef.current, ...a };
        c.setAgent(agentRef.current as ClientAgentConfig);
        c.updateSession({}); // push immediately
      },

      updateSession: (p: Partial<AgentConfigInput>) => {
        agentRef.current = { ...agentRef.current, ...p };
        c.updateSession(p as Partial<ClientAgentConfig>);
      },

      registerFunction: (name: string, fn: (args: any) => Promise<any> | any) => c.registerFunction(name, fn),

      hasFunction: (name: string) => c.hasFunction(name),
      listFunctionNames: () => c.listFunctionNames(),
      unregisterFunction: (name: string) => c.unregisterFunction(name),
      unregisterFunctionsByPrefix: (prefix: string, keep: string[] = []) =>
        c.unregisterFunctionsByPrefix(prefix, keep),
      
      setMicEnabled: (enabled: boolean) => c.setMicEnabled(enabled),
      isMicEnabled: () => c.isMicEnabled(),

      getClient: () => c,
      forceToolCall: (name: string, args?: any, sayAfter?: string) => c.forceToolCall(name, args, sayAfter),

      setCallbacks: (partial: {
        onShowComponent?: (name: string) => void;
        onServerEvent?: (ev: any) => void;
      }) => c.setCallbacks(partial),
    };
  }, [status, conversation, volume, events]);

  return <RealtimeCtx.Provider value={api}>{children}</RealtimeCtx.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeCtx);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}
