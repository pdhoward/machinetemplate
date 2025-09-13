'use client';

import React, { useMemo, useState } from 'react';
import { useToolRegistry } from '@/context/registry-context';

export default function ToolRegistryPanel() {
  const { entries, sourceStatus, stats, isLoading, refresh, enablePolling, disablePolling, setVerboseLogging } =
    useToolRegistry();
  const [open, setOpen] = useState(false);
  const [showCode, setShowCode] = useState<string | null>(null);
  const [logsOn, setLogsOn] = useState(false);

  const counts = useMemo(() => ({
    total: entries.length,
    getter: sourceStatus.getter.keys.length,
    realtime: sourceStatus.realtime.keys.length,
    global: sourceStatus.global.keys.length,
  }), [entries, sourceStatus]);

  return (
    <div className="fixed bottom-12 right-4 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-neutral-900 text-neutral-200 border border-neutral-700 px-3 py-2 text-xs shadow"
          title="Open Tool Registry Panel"
        >
          Tools: {counts.total}
        </button>
      ) : (
        <div className="w-[480px] max-h-[80vh] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
            <div className="text-sm text-neutral-200 font-medium">Tool Registry</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh('panel')}
                className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
              >
                Refresh
              </button>
              <button
                onClick={() => enablePolling(4000)}
                className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
              >
                Poll
              </button>
              <button
                onClick={disablePolling}
                className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
              >
                Stop
              </button>
             <button
                onClick={() => {
                    const next = !logsOn;
                    setLogsOn(next);
                    setVerboseLogging(next); // expects a boolean
                }}
                className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
                >
                {logsOn ? 'Logs On' : 'Logs Off'}
                </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
          </div>

          <div className="px-3 py-2 text-[11px] text-neutral-400 grid grid-cols-2 gap-2 border-b border-neutral-800">
            <div>
              <div>Loading: <span className={isLoading ? 'text-amber-400' : 'text-emerald-400'}>{String(isLoading)}</span></div>
              <div>Last: {stats.lastLoadedAt ? stats.lastLoadedAt.toLocaleTimeString() : '—'}</div>
              <div>Error: {stats.lastError ?? '—'}</div>
            </div>
            <div>
              <div>loads: {stats.loads} | updates: {stats.updates} | retries: {stats.retries}</div>
              <div>getter: {counts.getter} | realtime: {counts.realtime} | global: {counts.global}</div>
              <div>reason: {stats.lastReason ?? '—'}</div>
            </div>
          </div>

          <div className="max-h-[55vh] overflow-auto">
            {entries.length === 0 ? (
              <div className="px-3 py-6 text-neutral-500 text-sm">No tools loaded.</div>
            ) : (
              entries.map(e => (
                <div key={e.name} className="border-b border-neutral-900/70">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-neutral-200 text-sm font-medium">{e.name}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCode(p => (p === e.name ? null : e.name))}
                        className="rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs"
                      >
                        {showCode === e.name ? 'Hide' : 'View'}
                      </button>
                    </div>
                  </div>
                  {showCode === e.name && (
                    <pre className="px-3 pb-3 text-[12px] leading-relaxed overflow-auto text-neutral-300">
{safeToString(e.fn)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function safeToString(fn: Function): string {
  try { return fn.toString(); } catch { return '// source unavailable'; }
}
