// lint-tools.ts
// Lints HttpToolDescriptor[] for common templating & UI mistakes.

import { 
  collectTokens, 
  stripFilters, 
  inferRequiredArgs, 
  applyTemplate, 
  hasUnresolvedTokens, 
  getByPath 
} from "@/lib/utils"; // Assume utilities path

import { HttpToolDescriptorSchema } from "@/types/httpTool.schema"; 

export const LINTER_VERSION = "http-linter@1.0.4";

type Severity = "error" | "warning";

export type LintIssue = {
  severity: Severity;
  code: string;
  path: string;
  message: string;
  suggestion?: string;
};

export type LintResult = {
  name: string;
  tenantId?: string;
  enabled?: boolean;
  issues: LintIssue[];
  linterVersion?: string;
};

type ComponentReqs = Record<string, { requiredProps?: string[] }>; // Simplified; removed validate fn for now

const defaultComponentReqs: ComponentReqs = {
  payment_form: { requiredProps: ["tenantId", "amountCents", "clientSecret", "reservationId"] }, // Added reservationId based on data
};

const REQUEST_ALLOWED_ROOTS = new Set(["args", "secrets"]);
const UI_ALLOWED_ROOTS = new Set(["args", "response", "status"]);

// Recursive proxy for dummy values (handles nested paths)
function createRecursiveProxy(prefix: string): any {
  return new Proxy({}, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop === "symbol") {
        return undefined;
      }
      if (prop === "toString" || prop === "valueOf") {
        return () => prefix;
      }
      return createRecursiveProxy(`${prefix}_${prop}`);
    },
  });
}

function walkJson(value: unknown, cb: (path: string, str: string) => void, path: string[] = []) {
  if (typeof value === "string") return cb(path.join("."), value);
  if (Array.isArray(value)) return value.forEach((v, i) => walkJson(v, cb, [...path, String(i)]));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walkJson(v, cb, [...path, k]);
  }
}

export function lintHttpToolDescriptors(
  descriptors: any[], // Loose type for flexibility
  options?: { componentReqs?: ComponentReqs; dummyCtx?: Record<string, any> }
): LintResult[] {
  const results: LintResult[] = [];
  const compReqs = options?.componentReqs ?? defaultComponentReqs;

  for (const d of descriptors) {
    const issues: LintIssue[] = [];
    
    const parsed = HttpToolDescriptorSchema.safeParse(d);

    // first pass test of the objects based on schema
    if (!parsed.success) {
    // Add one issue per Zod error for clarity
      parsed.error.issues.forEach((zIssue) => {
        issues.push({
          severity: "error",
          code: "schema_invalid",
          path: zIssue.path.join("."),
          message: zIssue.message,
          suggestion: "Fix the schema violation in the tool descriptor.",
        });
      });
    }



    // Unified token root check (for requests and UI)
    const checkTokenRoots = (value: any, where: string, allowedRoots: Set<string>) => {
      walkJson(value, (at, str) => {
        for (const raw of collectTokens(str)) {
          const tok = stripFilters(raw);
          const root = tok.split(".")[0] || "";
          if (!allowedRoots.has(root)) {
            issues.push({
              severity: "error",
              code: `${where.split(".")[0]}.invalid_token_root`,
              path: `${where}.${at}`,
              message: `Invalid token root in ${where}: ${tok}. Allowed: ${[...allowedRoots].join(", ")}.`,
              suggestion: `Use a valid root or move to appropriate section.`,
            });
          }
        }
      });
    };

    // Request parts
    checkTokenRoots(
      { urlTemplate: d.http?.urlTemplate, headers: d.http?.headers, jsonBodyTemplate: d.http?.jsonBodyTemplate },
      "http",
      REQUEST_ALLOWED_ROOTS
    );

    // UI parts
    checkTokenRoots(
      { loadingMessage: d.ui?.loadingMessage, onSuccess: d.ui?.onSuccess?.open, onError: d.ui?.onError?.open },
      "ui",
      UI_ALLOWED_ROOTS
    );

    // okField sanity
    const ok = d.http?.okField;
    if (ok && !/^[A-Za-z0-9_.[\]]+$/.test(ok)) {
      issues.push({
        severity: "warning",
        code: "http.ok_field_suspicious",
        path: "http.okField",
        message: `okField "${ok}" has unusual characters. Prefer simple keys like "ok".`,
      });
    }

    // Component prop checks
    ["onSuccess", "onError"].forEach((branch) => {
      const open = d.ui?.[branch]?.open;
      if (!open) return;
      const comp = open.component_name || "";
      const req = compReqs[comp];
      if (!req?.requiredProps) return;
      const props = open.props || {};
      req.requiredProps.forEach((key) => {
        if (!(key in props)) {
          issues.push({
            severity: "error",
            code: "ui.required_prop_missing",
            path: `ui.${branch}.open.props.${key}`,
            message: `"${comp}" requires props.${key}.`,
            suggestion: `Add: "${key}": "{{response.${key}}}" or a literal.`,
          });
        }
      });
    });

    // Unresolved tokens (using recursive proxy to simulate presence)
    const dummyCtx = {
      args: createRecursiveProxy("__ARG"),
      secrets: createRecursiveProxy("__SECRET"),
      response: createRecursiveProxy("__RESP"),
      status: 200,
      ...options?.dummyCtx,
    };
    const reqCtx = { args: dummyCtx.args, secrets: dummyCtx.secrets };
    const reqRequired = inferRequiredArgs(d);

    const checkUnresolved = (value: any, where: string) => {
      const templated = applyTemplate(value, reqCtx);
      if (hasUnresolvedTokens(templated)) {
        const missing = collectTokens(value).filter((tok) => getByPath(reqCtx, tok) === undefined);
        if (missing.length) {
          issues.push({
            severity: "error",
            code: "request.unresolved_tokens",
            path: where,
            message: `Unresolved tokens in ${where}: ${missing.join(", ")}.`,
            suggestion: "Ensure valid roots and add missing required parameters.",
          });
        }
      }
    };

    checkUnresolved(d.http?.urlTemplate, "http.urlTemplate");
    checkUnresolved(d.http?.headers, "http.headers");
    checkUnresolved(d.http?.jsonBodyTemplate, "http.jsonBodyTemplate");

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