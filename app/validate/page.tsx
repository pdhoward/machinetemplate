// app/admin/lint/page.tsx
"use client";

import * as React from "react";
import { useTenant } from "@/context/tenant-context";

type Issue = {
  severity: "error" | "warning";
  code: string;
  path: string;
  message: string;
  suggestion?: string;
};

type ReportItem = {
  name: string;
  tenantId?: string;
  enabled?: boolean;
  issues: Issue[];
  linterVersion?: string; 
};

type LintResponse = {
  ok: boolean;
  linterVersion?: string; 
  meta?: {
    tenantId: string;
    total: number;
    totalErrors: number;
    totalWarnings: number;
    invalid: number;
  };
  invalid?: Array<{ _id: string; reason: string }>;
  report?: ReportItem[];
  error?: string;
};


function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "error" | "warn" | "muted";
}) {
  const cn =
    tone === "error"
      ? "border-red-600 "
      : tone === "warn"
      ? "border-amber-600 bg-amber-50"
      : tone === "muted"
      ? "border-neutral-200"
      : "border-neutral-200";
  return (
    <div className={`rounded-lg border p-3 bg-neutral-900 ${cn}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Badge({
  children,
  tone = "ok",
}: {
  children: React.ReactNode;
  tone?: "ok" | "error" | "warn" | "muted";
}) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  const cls =
    tone === "ok"
      ? "bg-green-100 text-green-800"
      : tone === "error"
      ? "bg-red-100 text-red-800"
      : tone === "warn"
      ? "bg-amber-100 text-amber-800"
      : "bg-neutral-100 text-neutral-700";
  return <span className={`${base} ${cls}`}>{children}</span>;
}


export default function LintAdminPage() {
  const { tenantId } = useTenant();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<LintResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runLint = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/lint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, onlyEnabled: true }),
      });
      const json: LintResponse = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to run linter.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    runLint();
  }, [runLint]);

   const linterVersion =
    data?.linterVersion ??
    data?.report?.[0]?.linterVersion ??
    "unknown";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Tool Lint Report
            <span className="rounded-md border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600">
              {linterVersion}
            </span>
          </h1>
          <p className="text-sm text-neutral-500">Tenant: <span className="font-medium">{tenantId}</span></p>
        </div>
        <button
          onClick={runLint}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 active:bg-neutral-200"
        >
          Re-run
        </button>
      </header>

      {loading ? (
        <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
          Running linter…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !data?.report ? (
        <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600">
          No report.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 ">
            <SummaryCard label="Total tools" value={data.meta?.total ?? 0} />
            <SummaryCard label="Errors" value={data.meta?.totalErrors ?? 0} tone="error" />
            <SummaryCard label="Warnings" value={data.meta?.totalWarnings ?? 0} tone="warn" />
            <SummaryCard label="Invalid docs" value={data.meta?.invalid ?? 0} tone="muted" />
          </div>

          {/* Invalid documents (failed Zod) */}
          {Boolean((data.invalid || []).length) && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="text-sm font-medium text-amber-800 mb-1">
                {data.invalid!.length} invalid descriptor(s) (failed schema validation)
              </div>
              <ul className="text-xs text-amber-800 list-disc ms-5">
                {data.invalid!.map((inv, i) => (
                  <li key={i}>
                    <span className="font-mono">{inv._id}</span>: {inv.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results table */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-900 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Tool</th>
                  <th className="px-3 py-2 text-left font-medium">Enabled</th>
                  <th className="px-3 py-2 text-left font-medium">Issues</th>
                  <th className="px-3 py-2 text-left font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {data.report.map((r, idx) => {
                  const errors = r.issues.filter(i => i.severity === "error");
                  const warnings = r.issues.filter(i => i.severity === "warning");
                  const ok = r.issues.length === 0;

                  return (
                    <tr key={idx} className="hover:bg-neutral-900">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-neutral-500">{r.tenantId || ""}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={r.enabled ? "ok" : "muted"}>{r.enabled ? "Yes" : "No"}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {ok ? (
                          <div className="flex items-center gap-2">
                            <Badge tone="ok">No issues</Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {errors.length > 0 && <Badge tone="error">{errors.length} error(s)</Badge>}
                            {warnings.length > 0 && <Badge tone="warn">{warnings.length} warning(s)</Badge>}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {ok ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <details className="group cursor-pointer">
                            <summary className="text-blue-700 hover:underline">View</summary>
                            <ul className="mt-2 space-y-2">
                              {r.issues.map((i, k) => (
                                <li key={k} className="rounded-md border p-2 text-xs">
                                  <div className="mb-1 flex items-center justify-between">
                                    <Badge tone={i.severity === "error" ? "error" : "warn"}>
                                      {i.severity}
                                    </Badge>
                                    <code className="text-[11px] text-neutral-500">{i.code}</code>
                                  </div>
                                  <div className="text-white">{i.message}</div>
                                  <div className="text-neutral-500 mt-1">
                                    <span className="font-mono">{i.path}</span>
                                  </div>
                                  {i.suggestion && (
                                    <div className="text-white mt-1">
                                      <span className="font-medium">Suggestion:</span> {i.suggestion}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
