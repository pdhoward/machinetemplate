// src/app/api/tools/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tpl, applyTemplate, pruneEmpty } from "@/lib/utils";

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

    const tenantId: string | undefined = args?.tenant_id;

    const secretsProxy = new Proxy({}, {
      get(_t, prop: string) {
        return resolveSecret(`secrets.${String(prop)}`, tenantId);
      },
    });

    const ctx = { ...args, args, secrets: secretsProxy }; // include args under ctx.args too (handy for UI templates)

    const method = descriptor?.http?.method ?? "POST";
    const rawUrl = String(descriptor.http.urlTemplate || "");
    const templatedUrl = tpl(rawUrl, ctx);

    // ✅ If relative (starts with “/”), make it absolute using the incoming request’s host/proto
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host  = req.headers.get("host") ?? "localhost";
    const url = /^(?:https?:)?\/\//.test(templatedUrl)
      ? templatedUrl
      : new URL(templatedUrl, `${proto}://${host}`).toString();

    const headers = Object.fromEntries(
      Object.entries(descriptor.http.headers ?? {}).map(([k, v]) => [k, tpl(String(v), ctx)])
    );

    let body: string | undefined;
    if (descriptor.http.jsonBodyTemplate != null) {
      let bodyObj = applyTemplate(descriptor.http.jsonBodyTemplate, ctx);

      // Optional: prune empties if you adopt this flag on descriptors
      if (descriptor.http.pruneEmpty) {
        bodyObj = pruneEmpty(bodyObj);
      }

      body = JSON.stringify(bodyObj);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      descriptor.http.timeoutMs ?? 15_000
    );

    const r = await fetch(url, { method, headers, body, signal: controller.signal });
    clearTimeout(timeout);

    const text = await r.text();
    try {
      const j = JSON.parse(text);
      return NextResponse.json(j, { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}