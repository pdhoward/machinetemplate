// lint-tools.ts
// Lints HttpToolDescriptor[] for common templating & UI mistakes.

import { HttpToolDescriptor } from "@/types/httpTool.schema";
import { 
  collectTokens, 
  stripFilters, 
  inferRequiredArgs,
  findMissingRequestTokens,
  applyTemplate, 
  hasUnresolvedTokens
} from "@/lib/utils";

export const LINTER_VERSION = "http-linter@1.0.3";

/* ----------------------------- Types ----------------------------- */

type Severity = "error" | "warning";

export type LintIssue = {
  severity: Severity;
  code: string;
  path: string;         // dotted path where the issue occurred
  message: string;
  suggestion?: string;
  exampleFix?: any;
};

export type LintResult = {
  name: string;
  tenantId?: string;
  enabled?: boolean;
  issues: LintIssue[];
  linterVersion?: string;
};

/* --------------------------- Constants --------------------------- */

const REQUEST_ALLOWED_ROOTS = new Set(["args", "secrets"]);
const UI_ALLOWED_ROOTS      = new Set(["args", "response", "status"]);

let x = 0

/* ----------------------------- Helpers --------------------------- */

const normalizeTokenPath = (raw: string) => stripFilters(raw); // "args.limit | number" → "args.limit"
const prettyTok          = (raw: string) => normalizeTokenPath(raw);
const p = (...segs: (string | number)[]) => segs.map(String).join(".");

function walkJson(
  value: unknown,
  cb: (path: string, str: string) => void,
  path: string[] = []
) {
  if (typeof value === "string") {
    cb(path.join("."), value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkJson(v, cb, path.concat(String(i))));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) =>
      walkJson(v, cb, path.concat(k))
    );
  }
}

/* --------------------- Optional component validator --------------------- */

export type ComponentReqs = Record<
  string,
  {
    requiredProps?: string[];
    validate?: (props: any, push: (issue: LintIssue) => void) => void;
  }
>;

const defaultComponentReqs: ComponentReqs = {
  payment_form: { requiredProps: ["tenantId", "amountCents", "clientSecret"] },
};

/* ------------------------------ Linter ------------------------------ */

export function lintHttpToolDescriptors(
  descriptors: HttpToolDescriptor[],
  options?: {
    componentReqs?: ComponentReqs;
    dummyCtx?: {
      args?: Record<string, any>;
      response?: Record<string, any>;
      secrets?: Record<string, string>;
      status?: number;
    };
  }
): LintResult[] {
  const results: LintResult[] = [];
  const compReqs = options?.componentReqs ?? defaultComponentReqs;

  for (const d of descriptors) {
    const issues: LintIssue[] = [];

    /* ---------- 1) Request token roots ---------- */
    const requestParts: Array<{ value: any; where: string }> = [
      { value: d.http?.urlTemplate,      where: "http.urlTemplate" },
      { value: d.http?.headers,          where: "http.headers" },
      { value: d.http?.jsonBodyTemplate, where: "http.jsonBodyTemplate" },
    ];

    requestParts.forEach(({ value, where }) => {
      walkJson(value, (at, str) => {
        for (const raw of collectTokens(str)) {
          const tok  = normalizeTokenPath(raw);
          const root = tok.split(".")[0]!;
          if (!REQUEST_ALLOWED_ROOTS.has(root)) {
            if (x<5) {
              console.debug("[lint:request-token]", { tool: d.name, where, token: raw, normalized: normalizeTokenPath(raw) });
              x++
            }
            issues.push({
              severity: "error",
              code: "request.invalid_token_root",
              path: p(where, at),
              message: `Only args.* or secrets.* may be used in the request. Found ${prettyTok(raw)}.`,
              suggestion:
                root === "response"
                  ? "Move this reference to the UI section (onSuccess/onError)."
                  : `Replace with an args.* placeholder (e.g., {{${tok.replace(/^.*?\./, "args.")}}}).`,
            });
          }
        }
      });
    });

    /* ---------- 2) okField sanity ---------- */
    if (d.http?.okField) {
      const ok = d.http.okField;
      if (!/^[A-Za-z0-9_.[\]]+$/.test(ok)) {
        issues.push({
          severity: "warning",
          code: "http.ok_field_suspicious",
          path: "http.okField",
          message: `okField "${ok}" contains unusual characters. Use "ok" or "clientSecret".`,
        });
      }
    }

    /* ---------- 3) UI token roots (no secrets) ---------- */
    const uiParts: Array<{ value: any; where: string }> = [
      { value: (d as any).ui?.loadingMessage, where: "ui.loadingMessage" },
      { value: (d as any).ui?.onSuccess?.open, where: "ui.onSuccess.open" },
      { value: (d as any).ui?.onError?.open,   where: "ui.onError.open" },
    ];
    uiParts.forEach(({ value, where }) => {
      walkJson(value, (at, str) => {
        for (const raw of collectTokens(str)) {
          const tok  = normalizeTokenPath(raw);
          const root = tok.split(".")[0]!;
          if (!UI_ALLOWED_ROOTS.has(root)) {
            issues.push({
              severity: "error",
              code: "ui.invalid_token_root",
              path: p(where, at),
              message: `UI may use args.*, response.*, or status. Found ${prettyTok(raw)}.`,
              suggestion:
                root === "secrets"
                  ? "Never reference secrets in UI/templates that reach the client."
                  : "Move this reference to the request or remove it.",
            });
          }
        }
      });
    });

    /* ---------- 4) Known component prop checks ---------- */
    (["onSuccess", "onError"] as const).forEach((branch) => {
      const open = (d as any)?.ui?.[branch]?.open;
      if (!open || typeof open !== "object") return;
      const comp = String(open.component_name || "");
      const req  = compReqs[comp];
      if (!req) return;

      const props = open.props;
      const push  = (issue: LintIssue) => issues.push(issue);

      if (req.requiredProps && props && typeof props === "object") {
        req.requiredProps.forEach((key) => {
          const has = Object.prototype.hasOwnProperty.call(props, key);
          if (!has) {
            push({
              severity: "error",
              code: "ui.required_prop_missing",
              path: p("ui", branch, "open.props", key),
              message: `"${comp}" requires props.${key} (templated or literal).`,
              suggestion: `Add props.${key}: "{{response.${key}}}" or "{{args.${key}}}".`,
            });
          }
        });
      }
      req.validate?.(props, push);
    });

    /* ---------- 5) Request-time unresolved-token safety net ---------- */
    const dummyCtx = {
      args:     new Proxy({}, { get: (_t, k) => `__ARG_${String(k)}__` }),
      response: new Proxy({}, { get: (_t, k) => `__RESP_${String(k)}__` }),
      secrets:  new Proxy({}, { get: (_t, k) => `__SECRET_${String(k)}__` }),
      status:   200,
      ...(options?.dummyCtx || {}),
    };
    const reqCtx = { args: dummyCtx.args, secrets: dummyCtx.secrets };

   // Step 7: request-time validation using shared utils (no brace heuristics)
    const reqRequired = inferRequiredArgs(d); // from utils
    const dummyReqCtx = { args: {}, secrets: {} }; // we only check structure/roots/requireds here

    const urlMissing = findMissingRequestTokens(
      d.http?.urlTemplate ?? "",
      dummyReqCtx,
      reqRequired
    );
    if (urlMissing.length) {
      issues.push({
        severity: "error",
        code: "request.unresolved_tokens",
        path: "http.urlTemplate",
        message: `Unresolved/invalid tokens in urlTemplate: ${urlMissing.join(", ")}.`,
        suggestion: "Fix token names, roots (args/secrets), or add missing required args.",
      });
    }

    const headerMissing = findMissingRequestTokens(
      d.http?.headers ?? {},
      dummyReqCtx,
      reqRequired
    );
    if (headerMissing.length) {
      issues.push({
        severity: "error",
        code: "request.unresolved_tokens",
        path: "http.headers",
        message: `Unresolved/invalid tokens in headers: ${headerMissing.join(", ")}.`,
        suggestion: "Fix token names, roots (args/secrets), or add missing required args.",
      });
    }

    const bodyMissing = findMissingRequestTokens(
      d.http?.jsonBodyTemplate ?? {},
      dummyReqCtx,
      reqRequired
    );
    if (bodyMissing.length) {
      issues.push({
        severity: "error",
        code: "request.unresolved_tokens",
        path: "http.jsonBodyTemplate",
        message: `Unresolved/invalid tokens in jsonBodyTemplate: ${bodyMissing.join(", ")}.`,
        suggestion: "Fix token names, roots (args/secrets), or add missing required args.",
      });
    }


    results.push({
      name: d.name,
      tenantId: d.tenantId,
      enabled: d.enabled,
      issues,
      linterVersion: LINTER_VERSION,
    });
  }

  return results;
}
