// lint-tools.ts
// Lints HttpToolDescriptor[] for common templating & UI mistakes.
// Render the returned issues in admin UI.

import { HttpToolDescriptor } from "@/types/httpTool.schema";

/* ----------------------------- Helpers ----------------------------- */

type Severity = "error" | "warning";

export type LintIssue = {
  severity: Severity;
  code: string;
  path: string;         // JSONPath-ish pointer where the issue occurred
  message: string;
  suggestion?: string;
  exampleFix?: any;
};

export type LintResult = {
  name: string;
  tenantId?: string;
  enabled?: boolean;
  issues: LintIssue[];
};

// Take "args.limit | number" → "args.limit"
// Take "response.items.length" → "response.items.length"
// (We do *not* support inline JS; tokens must be simple paths.)
function normalizeTokenPath(raw: string): string {
  return raw.split("|")[0]!.trim(); // strip any pipe suffix if present
}


// Very small JSON walker that returns all string values with their path
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

// Extract tokens as *bare* paths ("args.tenant_id"), no overlaps.
function extractTokens(s: string): string[] {
  const out: string[] = [];

  // 1) collect double-brace tokens first
  const dbl = s.match(/\{\{\s*([^{}]+?)\s*\}\}/g) || [];
  for (const m of dbl) {
    const p = m.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
    if (p) out.push(p);
  }

  // 2) strip double-brace spans before scanning singles, so we don't double-count
  const withoutDbl = s.replace(/\{\{\s*[^{}]+?\s*\}\}/g, "");

  // 3) collect single-brace tokens from the stripped string
  const sgl = withoutDbl.match(/\{([^{}]+?)\}/g) || [];
  for (const m of sgl) {
    const p = m.replace(/^\{|\}$/g, "").trim();
    if (p) out.push(p);
  }

  return out;
}


// Quick unresolved-token check after templating
function hasUnresolvedBraces(value: unknown): boolean {
  let found = false;
  walkJson(value, (_p, str) => {
    if (/\{\{[^}]+?\}\}|\{[^}]+?\}/.test(str)) found = true;
  });
  return found;
}

// Get path.root 
const rootOf = (tokenPath: string) => tokenPath.split(".")[0];

// tiny pretty-printer for messages
const prettyTok = (raw: string) => normalizeTokenPath(raw);

// Very small template applier (same semantics as your tpl/applyTemplate)
function getByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}
function tpl(str: string, ctx: any): string {
  if (typeof str !== "string") return str as any;
  // double first
  let out = str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, p1) => {
    const v = getByPath(ctx, String(p1).trim());
    return v == null ? "" : String(v);
  });
  // single
  out = out.replace(/\{([^}]+?)\}/g, (_m, p1) => {
    const v = getByPath(ctx, String(p1).trim());
    return v == null ? "" : String(v);
  });
  return out;
}
function applyTemplate<T = any>(value: T, ctx: any): T {
  if (value == null) return value;
  if (typeof value === "string") return tpl(value, ctx) as any;
  if (Array.isArray(value)) return value.map((v) => applyTemplate(v, ctx)) as any;
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = applyTemplate(v, ctx);
    }
    return out as T;
  }
  return value;
}

// JSON pointer-ish
const p = (...segs: (string | number)[]) => segs.map(String).join(".");

// Try to infer top-level required arg names from parameters schema (best effort)
function inferRequiredArgs(descriptor: HttpToolDescriptor): Set<string> {
  const req = new Set<string>();
  const params: any = descriptor.parameters || {};
  if (params && typeof params === "object" && Array.isArray(params.required)) {
    for (const k of params.required) if (typeof k === "string") req.add(k);
  }
  // also scan properties.*.required if it matches JSON-Schema
  if (params?.properties && typeof params.properties === "object") {
    Object.entries<any>(params.properties).forEach(([key, def]) => {
      if (def && typeof def === "object" && def.required && Array.isArray(def.required)) {
        req.add(key); // not perfect, but flags common mistakes
      }
    });
  }
  return req;
}

/* --------------------- Optional component validator --------------------- */
/**
 * For visuals where you have strong expectations, declare required props here.
 * Example shows "payment_form".
 */
export type ComponentReqs = Record<
  string,
  {
    requiredProps?: string[];
    // optional custom rule: (props, pushIssue) => void
    validate?: (props: any, push: (issue: LintIssue) => void) => void;
  }
>;

const defaultComponentReqs: ComponentReqs = {
  payment_form: {
    requiredProps: ["tenantId", "amountCents", "clientSecret"],
  },
};

/* ----------------------------- The Linter ----------------------------- */

export function lintHttpToolDescriptors(
  descriptors: HttpToolDescriptor[],
  options?: {
    componentReqs?: ComponentReqs;
    // fake values used to render templates; keeps “unresolved token” checks useful
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
    const reqArgs = inferRequiredArgs(d);

    /* ---------- 1) Request section token roots ---------- */
    // urlTemplate + headers + jsonBodyTemplate may only use args.* or secrets.* (status not available; response not available yet)
    const requestRootsAllowed = new Set(["args", "secrets"]);
    const requestParts: Array<{ value: any; where: string }> = [
      { value: d.http?.urlTemplate, where: "http.urlTemplate" },
      { value: d.http?.headers, where: "http.headers" },
      { value: d.http?.jsonBodyTemplate, where: "http.jsonBodyTemplate" },
    ];

    requestParts.forEach(({ value, where }) => {
      walkJson(value, (at, str) => {
        const tokens = extractTokens(str);
        tokens.forEach((rawTok) => {
          const tok  = normalizeTokenPath(rawTok);
          const root = rootOf(tok)
          if (!requestRootsAllowed.has(root)) {
            issues.push({
              severity: "error",
              code: "request.invalid_token_root",
              path: p(where, at),
              // request.invalid_token_root
              message: `Only args.* or secrets.* may be used in the request. Found ${prettyTok(rawTok)}.`,
              suggestion: root === "response"
                ? "Move this reference to the UI section (onSuccess/onError)."
                : `Replace with an args.* placeholder (e.g., {{${tok.replace(/^.*?\./, "args.")}}}).`,
            });
          }
        });
      });
    });

    /* ---------- 2) jsonBodyTemplate object-string pitfalls ---------- */
    // Detect values like "{{args.prefill}}" (single token, likely an object) at object positions.
    // Heuristic: if the string is exactly a single token and its path ends with a key that often expects an object.
    const objectyKeys = new Set(["customer", "guest", "address", "payment", "prefill"]);
    walkJson(d.http?.jsonBodyTemplate, (at, str) => {
      const tokens = extractTokens(str);
      if (tokens.length === 1) {
        const tok = tokens[0];
        const leafKey = at.split(".").pop() || "";
        if (objectyKeys.has(leafKey) && !tok.includes(".")) {
          issues.push({
            severity: "warning",
            code: "body.possible_object_string",
            path: p("http.jsonBodyTemplate", at),
            message: `Value "${str}" looks like an object placeholder. This can become "[object Object]" in logs & may break your target API.`,
            suggestion: `Expand fields explicitly (e.g., { name: "{{args.prefill.name}}", email: "{{args.prefill.email}}" }).`,
          });
        }
      }
    });

    /* ---------- 3) okField sanity ---------- */
    if (d.http?.okField) {
      const ok = d.http.okField;
      if (!/^[A-Za-z0-9_.[\]]+$/.test(ok)) {
        issues.push({
          severity: "warning",
          code: "http.ok_field_suspicious",
          path: "http.okField",
          message: `okField "${ok}" contains unusual characters. Use a simple key/path like "ok" or "clientSecret".`,
        });
      }
    }

    /* ---------- 4) UI section token roots + no secrets in UI ---------- */
    // In UI, allow args.*, response.*, status
    // Forbid secrets.* so they never leak to the client.
    const uiRootsAllowed = new Set(["args", "response", "status"]);
    const uiParts: Array<{ value: any; where: string }> = [
      { value: d.ui?.loadingMessage, where: "ui.loadingMessage" },
      { value: d.ui?.onSuccess?.open, where: "ui.onSuccess.open" },
      { value: d.ui?.onError?.open, where: "ui.onError.open" },
    ];
    uiParts.forEach(({ value, where }) => {
      walkJson(value, (at, str) => {
        const tokens = extractTokens(str);
        tokens.forEach((rawTok) => {
          const tok  = normalizeTokenPath(rawTok);
          const root = rootOf(tok)
          if (!uiRootsAllowed.has(root)) {
            issues.push({
              severity: "error",
              code: "ui.invalid_token_root",
              path: p(where, at),
              // ui.invalid_token_root
              message: `UI may use args.*, response.*, or status. Found ${prettyTok(rawTok)}.`,
              suggestion: root === "secrets"
                ? "Never reference secrets in UI/templates that reach the client."
                : "Move this reference to the request or remove it.",
            });
          }
        });
      });
    });

    /* ---------- 5) UI required props for known components ---------- */
    (["onSuccess", "onError"] as const).forEach((branch) => {
      const open = (d.ui as any)?.[branch]?.open;
      if (!open || typeof open !== "object") return;
      const comp = String(open.component_name || "");
      const req = compReqs[comp];
      if (!req) return;

      const props = open.props;
      const push = (issue: LintIssue) => issues.push(issue);

      if (req.requiredProps && props && typeof props === "object") {
        req.requiredProps.forEach((key) => {
          const has = Object.prototype.hasOwnProperty.call(props, key);
          if (!has) {
            push({
              severity: "error",
              code: "ui.required_prop_missing",
              path: p("ui", branch, "open.props", key),
              message: `"${comp}" requires props.${key} (templated or literal).`,
              suggestion: `Add props.${key}: "{{response.${key}}}" or "{{args.${key}}}" as appropriate.`,
            });
          }
        });
      }
      req.validate?.(props, push);
    });

   /* ---------- 6) Args referenced in request that are not declared in parameters.properties ---------- */
    // Only warn if an arg.* is used but not *declared as a property* at all.
    // Optional vs required is fine; don't force required.
    const paramsObj = (d.parameters && typeof d.parameters === "object"
      && (d.parameters as any).properties
      && typeof (d.parameters as any).properties === "object")
      ? (d.parameters as any).properties
      : {};

    const declaredKeys = new Set<string>(Object.keys(paramsObj));

    const argsUsedInRequest = new Set<string>();
    requestParts.forEach(({ value }) => {
      walkJson(value, (_at, str) => {
        extractTokens(str).forEach((rawTok) => {
          const tok = normalizeTokenPath(rawTok); // <— strip filters if any
          if (tok.startsWith("args.")) {
            const head = tok.split(".")[1]; // "tenant_id" from "args.tenant_id"
            if (head) argsUsedInRequest.add(head);
          }
        });
      });
    });

    for (const a of argsUsedInRequest) {
      if (!declaredKeys.has(a)) {
        issues.push({
          severity: "warning",
          code: "parameters.property_missing",
          path: "parameters.properties",
          message: `Template references ${prettyTok(`args.${a}`)} but it is not declared in parameters.properties.`,
          suggestion: `Add a "properties.${a}" entry (and add to "required" only if it’s mandatory).`,
        });
      }
    }


    /* ---------- 7) Simulated templating → unresolved tokens ---------- */
    // Use a dummy context so we can catch typos like {{arg.tenant_id}} (missing 's')
    const dummyCtx = {
      args: new Proxy({}, { get: (_t, k) => `__ARG_${String(k)}__` }),
      response: new Proxy({}, { get: (_t, k) => `__RESP_${String(k)}__` }),
      secrets: new Proxy({}, { get: (_t, k) => `__SECRET_${String(k)}__` }),
      status: 200,
      ...(options?.dummyCtx || {}),
    };

    // Request must not have unresolved tokens after applying args/secrets only.
    const reqCtx = { args: dummyCtx.args, secrets: dummyCtx.secrets };
    const renderedUrl = applyTemplate(d.http?.urlTemplate ?? "", reqCtx);
    const renderedHeaders = applyTemplate(d.http?.headers ?? {}, reqCtx);
    const renderedBody = applyTemplate(d.http?.jsonBodyTemplate ?? {}, reqCtx);

    if (hasUnresolvedBraces(renderedUrl)) {
      issues.push({
        severity: "error",
        code: "request.unresolved_tokens",
        path: "http.urlTemplate",
        message: "Unresolved tokens remain after templating urlTemplate with args/secrets.",
        suggestion: "Fix token names or add the missing args.* keys.",
      });
    }
    if (hasUnresolvedBraces(renderedHeaders)) {
      issues.push({
        severity: "error",
        code: "request.unresolved_tokens",
        path: "http.headers",
        message: "Unresolved tokens remain in headers after templating with args/secrets.",
        suggestion: "Fix token names or add the missing args.* keys.",
      });
    }
    if (hasUnresolvedBraces(renderedBody)) {
      issues.push({
        severity: "error",
        code: "request.unresolved_tokens",
        path: "http.jsonBodyTemplate",
        message: "Unresolved tokens remain in jsonBodyTemplate after templating with args/secrets.",
        suggestion: "Fix token names or add the missing args.* keys.",
      });
    }

    results.push({
      name: d.name,
      tenantId: d.tenantId,
      enabled: d.enabled,
      issues,
    });
  }

  return results;
}
