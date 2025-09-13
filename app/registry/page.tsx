'use client';

import React, { useMemo, useState } from 'react';
import { useToolRegistry } from '@/context/registry-context';

export default function RegistryPage() {
  const { entries, refresh, sourceStatus, stats, isLoading } = useToolRegistry();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(t =>
      t.name.toLowerCase().includes(q) ||
      safeToString(t.fn).toLowerCase().includes(q)
    );
  }, [query, entries]);

  const toggle = (name: string) =>
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const copy = async (name: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(name);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const total = entries.length;

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
              onClick={() => refresh('button')}
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
            {stats.lastLoadedAt
              ? <>Last loaded {stats.lastLoadedAt.toLocaleTimeString()} ({stats.lastReason})</>
              : <>Not loaded yet</>}
            {isLoading && <span className="ml-2 text-amber-400">loading…</span>}
          </div>
        </section>

        {/* Source health */}
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <HealthCard title="Getter" status={sourceStatus.getter} />
          <HealthCard title="Realtime" status={sourceStatus.realtime} />
          <HealthCard title="Global" status={sourceStatus.global} />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
          <div className="grid grid-cols-12 border-b border-neutral-800 bg-neutral-900/60">
            <div className="col-span-4 px-4 py-3 text-xs uppercase tracking-wider text-neutral-400">Tool</div>
            <div className="col-span-6 px-4 py-3 text-xs uppercase tracking-wider text-neutral-400">Preview</div>
            <div className="col-span-2 px-4 py-3 text-xs uppercase tracking-wider text-neutral-400 text-right">Actions</div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-sm text-neutral-400">
              {total === 0 ? 'No tools found in the registry.' : 'No results match your search.'}
            </div>
          ) : (
            filtered.map(t => {
              const isOpen = !!expanded[t.name];
              const src = safeToString(t.fn);
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
{firstNonEmptyLine(src) || '// no source available'}
                    </pre>

                    {isOpen && (
                      <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950">
                        <div className="px-3 py-2 border-b border-neutral-800 text-xs text-neutral-400">Full source</div>
                        <pre className="p-3 text-[12px] leading-relaxed overflow-auto">
{src}
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
                      onClick={() => copy(t.name, src)}
                      className="rounded-lg bg-neutral-800 hover:bg-neutral-700 transition px-3 py-1.5 text-xs border border-neutral-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 text-xs text-neutral-500">
          Showing {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
          {filtered.length !== total && <> (of {total})</>}
        </div>
      </div>
    </div>
  );
}

function HealthCard({ title, status }: { title: string; status: { available: boolean; keys: string[] } }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-1 text-sm text-neutral-200">
        {status.available ? (
          <span className="text-emerald-400">available</span>
        ) : (
          <span className="text-rose-400">not available</span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-neutral-500 truncate">
        keys: {status.keys.length ? status.keys.join(', ') : '—'}
      </div>
    </div>
  );
}

function safeToString(fn: Function): string {
  try { return fn.toString(); } catch { return '// source unavailable'; }
}
function firstNonEmptyLine(src: string): string {
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (line) return line;
  }
  return '';
}
