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

  // --- stable client getter ---
  const getClient = useCallback(() => clientRef.current!, []);

  // --- stable methods (do NOT depend on changing state) ---
  const connect               = useCallback((p?: { requestMic?: boolean }) => getClient().connect(p), [getClient]);
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
