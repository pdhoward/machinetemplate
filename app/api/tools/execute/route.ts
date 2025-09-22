// src/app/api/tools/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tpl, applyTemplate } from "@/lib/utils";

// Replace with your real secret store (KMS, Vault, Mongo per-tenant, etc.)
function resolveSecret(path: string, tenantId?: string): string {
  // path looks like "secrets.booking_api_key"
  if (path === "secrets.booking_api_key") {
    const v = process.env.BOOKING_API_KEY ?? "";
    return v;
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const { descriptor, args } = await req.json();

    if (!descriptor?.http?.urlTemplate) {
      return NextResponse.json(
        { ok: false, error: "Missing descriptor.http.urlTemplate" },
        { status: 400 }
      );
    }

    const tenantId: string | undefined = args?.tenant_id;

    // Build ctx with args + secret proxy
    const secretsProxy = new Proxy(
      {},
      {
        get(_t, prop: string) {
          // supports {{secrets.something}}
          return resolveSecret(`secrets.${String(prop)}`, tenantId);
        },
      }
    );

    const ctx = { ...args, secrets: secretsProxy };

    const method = (descriptor.http.method ?? "POST").toUpperCase();

    // Template URL + headers + body safely
    const rawUrl = String(descriptor.http.urlTemplate);
    const url = tpl(rawUrl, ctx);

    // Sanity-check: ensure no braces remain (bad template)
    if (/\{[^}]*\}/.test(url) || /\{\{[^}]*\}\}/.test(url)) {
      return NextResponse.json(
        { ok: false, error: `Unresolved template vars in URL: "${url}"` },
        { status: 400 }
      );
    }

    // Headers (template each value)
    const rawHeaders = descriptor.http.headers ?? {};
    const headersEntries = Object.entries(rawHeaders).map(([k, v]) => [k, tpl(String(v), ctx)]);
    // drop empty header values
    const headers = Object.fromEntries(headersEntries.filter(([_, v]) => v != null && v !== ""));

    // GET should not send body
    let body: string | undefined = undefined;
    if (method !== "GET" && descriptor.http.jsonBodyTemplate != null) {
      const templated = applyTemplate(descriptor.http.jsonBodyTemplate, ctx);
      body = JSON.stringify(templated);
      // set content-type only when we actually send a body
      if (!headers["content-type"]) headers["content-type"] = "application/json";
    } else {
      // ensure we don't force content-type on GET
      if (method === "GET" && headers["content-type"]) delete headers["content-type"];
    }

    // Timeout
    const controller = new AbortController();
    const timeoutMs = Number(descriptor.http.timeoutMs ?? 15000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    // Pass-through status; attempt JSON, fallback to text
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (err: any) {
    console.error("[/api/tools/execute] error:", err?.stack || err?.message || err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
