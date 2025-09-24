// src/app/api/tools/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tpl, applyTemplate, pruneEmpty } from "@/lib/utils";

/** Simple trace id for correlating logs across hops */
const mkTraceId = (prefix = "exec") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Redact obvious secrets in headers */
function redactHeaders(h: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h || {})) {
    const low = k.toLowerCase();
    out[k] =
      low.includes("authorization") || low.includes("api-key") || low.includes("x-api-key")
        ? "[REDACTED]"
        : v;
  }
  return out;
}

/** Truncate large payloads to keep logs readable */
function snap(v: unknown, n = 1500) {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (!s) return s;
    return s.length > n ? s.slice(0, n) + "…(truncated)" : s;
  } catch {
    return String(v);
  }
}

// Replace with your real secret store (KMS, Vault, Mongo per-tenant, etc.)
function resolveSecret(path: string, tenantId?: string): string {
  // path looks like "secrets.booking_api_key"
  if (path === "secrets.booking_api_key") {
    return process.env.BOOKING_API_KEY ?? "";
  }
  return "";
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") ?? mkTraceId();
  try {
    const started = Date.now();
    const { descriptor, args } = await req.json();

    const toolName: string = descriptor?.name ?? "(unknown)";
    const tenantId: string | undefined = args?.tenant_id;

    // Secrets proxy used by {{secrets.*}} tokens
    const secretsProxy = new Proxy({}, {
      get(_t, prop: string) {
        return resolveSecret(`secrets.${String(prop)}`, tenantId);
      },
    });

    const ctx = { ...args, args, secrets: secretsProxy };

    const method = descriptor?.http?.method ?? "POST";
    const rawUrl = String(descriptor.http.urlTemplate || "");
    const templatedUrl = tpl(rawUrl, ctx);

    // Build absolute URL for server-side fetch
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host  = req.headers.get("host") ?? "localhost";
    const url = /^(?:https?:)?\/\//.test(templatedUrl)
      ? templatedUrl
      : new URL(templatedUrl, `${proto}://${host}`).toString();

    // Template headers (redacted for logs)
    const headers: Record<string, string> = Object.fromEntries(
      Object.entries(descriptor.http.headers ?? {}).map(([k, v]) => [k, tpl(String(v), ctx)])
    );
    headers["x-trace-id"] = traceId; // pass through for downstream services

    // Template/prepare body
    let body: string | undefined;
    let bodyObj: any = undefined;
    if (descriptor.http.jsonBodyTemplate != null) {
      bodyObj = applyTemplate(descriptor.http.jsonBodyTemplate, ctx);
      if (descriptor.http.pruneEmpty) {
        bodyObj = pruneEmpty(bodyObj);
      }
      body = JSON.stringify(bodyObj);
    }

    // ---- OUTBOUND LOG -----------------------------------------------------
    console.log(`[EXEC] ${traceId} → ${method} ${url}`, {
      tool: toolName,
      tenantId,
      okField: descriptor.http.okField ?? "(http 2xx)",
      headers: redactHeaders(headers),
      body: snap(bodyObj),
    });

    // Do the call
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), descriptor.http.timeoutMs ?? 15_000);

    const r = await fetch(url, { method, headers, body, signal: controller.signal });
    clearTimeout(timeout);

    const text = await r.text();

    // ---- INBOUND LOG ------------------------------------------------------
    console.log(`[EXEC] ${traceId} ← ${r.status} (${Date.now() - started}ms)`, {
      tool: toolName,
      response: snap(text),
    });

    // Return JSON if possible
    try {
      const j = JSON.parse(text);
      return NextResponse.json(j, { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch (err: any) {
    console.error(`[EXEC] ${traceId} ERROR`, {
      error: err?.message || String(err),
      stack: err?.stack,
    });
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
