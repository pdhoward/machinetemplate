'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    getToolRegistrySnapshot?: () => Record<string, Function> | undefined;
    __OPENAI_TOOL_REGISTRY?: Record<string, Function>;
    realtime?: {
      getFunctionRegistrySnapshot?: () => Record<string, Function>;
    };
  }
}

type ToolEntry = { name: string; fn: Function; source: string };

export default function RegistryPage() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const readSnapshot = useCallback((): Record<string, Function> | null => {
    try {
      // 1) Preferred: explicit getter exposed by the client
      if (typeof window.getToolRegistrySnapshot === 'function') {
        const snap = window.getToolRegistrySnapshot();
        if (snap) return snap;
      }
      // 2) Instance method on your realtime client (if surfaced)
      if (window.realtime?.getFunctionRegistrySnapshot) {
        return window.realtime.getFunctionRegistrySnapshot();
      }
      // 3) Global mirror (from registerFunction)
      if (window.__OPENAI_TOOL_REGISTRY) {
        return { ...window.__OPENAI_TOOL_REGISTRY };
      }
      return null;
    } catch (e: any) {
      setError(e?.message ?? String(e));
      return null;
    }
  }, []);

  const load = useCallback(() => {
    setError(null);
    const snap = readSnapshot();
    if (!snap) {
      setTools([]);
      setError(
        'No registry found. Make sure to call client.exposeRegistryToWindow() or mirror __OPENAI_TOOL_REGISTRY.'
      );
      setLastLoadedAt(new Date());
      return;
    }
    const entries = Object.entries(snap)
      .map(([name, fn]) => ({ name, fn, source: safeToString(fn) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setTools(entries);
    setLastLoadedAt(new Date());
  }, [readSnapshot]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('tool-registry-updated', handler);
    return () => window.removeEventListener('tool-registry-updated', handler);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(t => t.name.toLowerCase().includes(q) || t.source.toLowerCase().includes(q));
  }, [query, tools]);

  const toggle = (name: string) =>
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const copy = async (name: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(name);
      setTimeout(() => setCopied(null), 1200);
    } catch {/* ignore */}
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tool Registry</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Functions registered with your OpenAI Realtime/Live session.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="rounded-xl bg-neutral-800 hover:bg-neutral-700 transition px-4 py-2 text-sm border border-neutral-700"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by tool name or code…"
              className="w-full rounded-xl bg-neutral-900 border border-neutral-800 focus:border-neutral-600 outline-none px-4 py-2 text-sm placeholder:text-neutral-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            {lastLoadedAt ? <>Last loaded {lastLoadedAt.toLocaleTimeString()}</> : <>Not loaded yet</>}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-900 bg-rose-950/30 text-rose-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
          <div className="grid grid-cols-12 border-b border-neutral-800 bg-neutral-900/60">
            <div className="col-span-4 px-4 py-3 text-xs uppercase tracking-wider text-neutral-400">Tool</div>
            <div className="col-span-6 px-4 py-3 text-xs uppercase tracking-wider text-neutral-400">Preview</div>
            <div className="col-span-2 px-4 py-3 text-xs uppercase tracking-wider text-neutral-400 text-right">Actions</div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-sm text-neutral-400">
              {tools.length === 0 ? 'No tools found in the registry.' : 'No results match your search.'}
            </div>
          ) : (
            filtered.map(t => {
              const isOpen = !!expanded[t.name];
              return (
                <div key={t.name} className="grid grid-cols-12 border-b border-neutral-800/60 hover:bg-neutral-900/30 transition">
                  <div className="col-span-4 px-4 py-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                      tool
                    </span>
                    <span className="font-medium">{t.name}</span>
                  </div>

                  <div className="col-span-6 px-4 py-3">
                    <pre className="max-h-24 overflow-hidden text-[11.5px] leading-relaxed whitespace-pre-wrap text-neutral-300">
{firstNonEmptyLine(t.source) || '// no source available'}
                    </pre>

                    {isOpen && (
                      <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950">
                        <div className="px-3 py-2 border-b border-neutral-800 text-xs text-neutral-400">Full source</div>
                        <pre className="p-3 text-[12px] leading-relaxed overflow-auto">
{t.source}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 px-4 py-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => toggle(t.name)}
                      className="rounded-lg bg-neutral-800 hover:bg-neutral-700 transition px-3 py-1.5 text-xs border border-neutral-700"
                    >
                      {isOpen ? 'Hide code' : 'View code'}
                    </button>
                    <button
                      onClick={() => copy(t.name, t.source)}
                      className="rounded-lg bg-neutral-800 hover:bg-neutral-700 transition px-3 py-1.5 text-xs border border-neutral-700"
                    >
                      {copied === t.name ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 text-xs text-neutral-500">
          Showing {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
          {filtered.length !== tools.length && <> (of {tools.length})</>}
        </div>
      </div>
    </div>
  );
}

function safeToString(fn: Function): string {
  try {
    return fn.toString();
  } catch {
    return '// source unavailable';
  }
}

function firstNonEmptyLine(src: string): string {
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line) return line;
  }
  return '';
}
