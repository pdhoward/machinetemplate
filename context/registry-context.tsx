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

type ToolFn = Function;
type ToolSnapshot = Record<string, ToolFn>;

type SourceStatus = {
  getter: { available: boolean; keys: string[] };
  realtime: { available: boolean; keys: string[] };
  global: { available: boolean; keys: string[] };
};

type LoadStats = {
  lastLoadedAt: Date | null;
  lastError: string | null;
  lastReason: string | null;
  loads: number;          // total load() calls
  updates: number;        // 'tool-registry-updated' events processed
  retries: number;        // retry loop attempts
};

type ToolRegistryState = {
  tools: ToolSnapshot;
  entries: { name: string; fn: ToolFn }[];
  sourceStatus: SourceStatus;
  stats: LoadStats;
  isLoading: boolean;
};

type ToolRegistryContextValue = ToolRegistryState & {
  refresh: (reason?: string) => void;
  enablePolling: (ms?: number) => void;
  disablePolling: () => void;
  // debugging controls
  setVerboseLogging: (on: boolean) => void;
};

const ToolRegistryContext = createContext<ToolRegistryContextValue | null>(null);

// ---------- Utilities ----------
const safeKeys = (obj?: Record<string, any> | null) =>
  obj ? Object.keys(obj) : [];

function sourceNow(): SourceStatus {
  if (typeof window === 'undefined') {
    return {
      getter:   { available: false, keys: [] },
      realtime: { available: false, keys: [] },
      global:   { available: false, keys: [] },
    };
  }

  // 1) Preferred: explicit getter installed by your Realtime client
  let getterKeys: string[] = [];
  const getterAvailable =
    typeof (window as any).getToolRegistrySnapshot === 'function';
  if (getterAvailable) {
    try {
      const snap = (window as any).getToolRegistrySnapshot?.();
      getterKeys = safeKeys(snap);
    } catch {
      // ignore
    }
  }

  // 2) Realtime instance path
  let realtimeKeys: string[] = [];
  const r = (window as any).realtime;
  const realtimeAvailable = !!r?.getFunctionRegistrySnapshot;
  if (realtimeAvailable) {
    try {
      const snap = r.getFunctionRegistrySnapshot?.();
      realtimeKeys = safeKeys(snap);
    } catch {
      // ignore
    }
  }

  // 3) Global mirror
  let globalKeys: string[] = [];
  const globalObj = (window as any).__OPENAI_TOOL_REGISTRY;
  const globalAvailable = !!globalObj;
  if (globalAvailable) {
    try {
      globalKeys = safeKeys(globalObj);
    } catch {
      // ignore
    }
  }

  return {
    getter:   { available: getterAvailable,  keys: getterKeys },
    realtime: { available: realtimeAvailable, keys: realtimeKeys },
    global:   { available: globalAvailable,  keys: globalKeys },
  };
}

function pickBestSnapshot(): { src: keyof SourceStatus; data: ToolSnapshot | null } {
  if (typeof window === 'undefined') return { src: 'getter', data: null };

  // priority: getter -> realtime -> global
  try {
    if (typeof (window as any).getToolRegistrySnapshot === 'function') {
      const snap = (window as any).getToolRegistrySnapshot?.();
      if (snap && Object.keys(snap).length) return { src: 'getter', data: snap };
    }
  } catch { /* ignore */ }

  try {
    const rt = (window as any).realtime;
    const snap = rt?.getFunctionRegistrySnapshot?.();
    if (snap && Object.keys(snap).length) return { src: 'realtime', data: snap };
  } catch { /* ignore */ }

  try {
    const snap = (window as any).__OPENAI_TOOL_REGISTRY;
    if (snap && Object.keys(snap).length) return { src: 'global', data: { ...snap } };
  } catch { /* ignore */ }

  return { src: 'getter', data: null };
}

// ---------- Provider ----------
export function ToolRegistryProvider({
  children,
  retryCount = 6,     // tries after mount
  retryEveryMs = 350, // spacing between tries
  initialVerbose = false,
}: {
  children: React.ReactNode;
  retryCount?: number;
  retryEveryMs?: number;
  initialVerbose?: boolean;
}) {
  const [tools, setTools] = useState<ToolSnapshot>({});
  const [sourceStatus, setSourceStatus] = useState<SourceStatus>(sourceNow());
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<LoadStats>({
    lastLoadedAt: null,
    lastError: null,
    lastReason: null,
    loads: 0,
    updates: 0,
    retries: 0,
  });
  const [verbose, setVerbose] = useState(initialVerbose);

  const pollRef = useRef<number | null>(null);

  const log = useCallback((...args: any[]) => {
    if (verbose) console.log('[ToolRegistry]', ...args);
  }, [verbose]);

  const loadOnce = useCallback((reason: string) => {
    if (typeof window === 'undefined') return;

    setIsLoading(true);
    const status = sourceNow();
    setSourceStatus(status);

    const picked = pickBestSnapshot();
    const now = new Date();

    if (!picked.data) {
      setIsLoading(false);
      setStats(s => ({
        ...s,
        lastLoadedAt: now,
        lastError: 'No registry available from getter/realtime/global.',
        lastReason: reason,
        loads: s.loads + 1,
      }));
      log('loadOnce:', reason, '→ no data', status);
      return;
    }

    setTools(picked.data);
    setIsLoading(false);
    setStats(s => ({
      ...s,
      lastLoadedAt: now,
      lastError: null,
      lastReason: `${reason} (${picked.src})`,
      loads: s.loads + 1,
    }));
    log('loadOnce:', reason, '→', Object.keys(picked.data).length, 'tools via', picked.src);
  }, [log]);

  const refresh = useCallback((reason?: string) => {
    loadOnce(reason ?? 'manual');
  }, [loadOnce]);

  const enablePolling = useCallback((ms?: number) => {
    const interval = Math.max(250, ms || 5000);
    if (pollRef.current) window.clearInterval(pollRef.current);
    // @ts-ignore
    pollRef.current = window.setInterval(() => {
      loadOnce('poll');
    }, interval);
    log('polling enabled @', interval, 'ms');
  }, [loadOnce, log]);

  const disablePolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
      log('polling disabled');
    }
  }, [log]);

  // Initial mount: do an immediate load + small retry loop
  useEffect(() => {
    if (typeof window === 'undefined') return;

    loadOnce('mount');

    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      const status = sourceNow();
      const picked = pickBestSnapshot();
      const haveAny =
        status.getter.keys.length > 0 ||
        status.realtime.keys.length > 0 ||
        status.global.keys.length > 0;
      setSourceStatus(status);
      setStats(s => ({ ...s, retries: tries }));

      if (picked.data) {
        setTools(picked.data);
        setStats(s => ({
          ...s,
          lastLoadedAt: new Date(),
          lastError: null,
          lastReason: `retry(${tries})`,
          loads: s.loads + 1,
        }));
        log('retry success @', tries, '→', Object.keys(picked.data).length, 'tools');
        window.clearInterval(id);
      } else if (tries >= retryCount) {
        log('retry gave up @', tries, 'haveAny?', haveAny, status);
        window.clearInterval(id);
      }
    }, retryEveryMs);

    return () => window.clearInterval(id);
  }, [loadOnce, retryCount, retryEveryMs, log]);

  // Live updates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (ev: any) => {
      setStats(s => ({ ...s, updates: s.updates + 1 }));
      loadOnce('event');
    };
    window.addEventListener('tool-registry-updated', handler);
    return () => window.removeEventListener('tool-registry-updated', handler);
  }, [loadOnce]);

  const entries = useMemo(
    () =>
      Object.entries(tools)
        .map(([name, fn]) => ({ name, fn }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tools]
  );

  const value: ToolRegistryContextValue = {
    tools,
    entries,
    sourceStatus,
    stats,
    isLoading,
    refresh,
    enablePolling,
    disablePolling,
    setVerboseLogging: setVerbose,
  };

  return (
    <ToolRegistryContext.Provider value={value}>
      {children}
    </ToolRegistryContext.Provider>
  );
}

export function useToolRegistry(): ToolRegistryContextValue {
  const ctx = useContext(ToolRegistryContext);
  if (!ctx) throw new Error('useToolRegistry must be used within a ToolRegistryProvider');
  return ctx;
}
