// src/app/api/tools/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tpl, applyTemplate } from "@/lib/utils";

// Example secret resolver. Replace with your real per-tenant solution.
function resolveSecret(path: string, tenantId?: string): string {
  // e.g. "secrets.booking_api_key"
  if (path === "secrets.booking_api_key") {
    return process.env.BOOKING_API_KEY ?? "";
  }
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const { descriptor, args } = await req.json();
    const tenantId: string | undefined = args?.tenant_id;

    // Build ctx with args + secrets
    const secretsProxy = new Proxy(
      {},
      {
        get(_t, prop: string) {
          return resolveSecret(`secrets.${String(prop)}`, tenantId);
        },
      }
    );

    const ctx = { ...args, secrets: secretsProxy };

    const method = descriptor?.http?.method ?? "POST";
    const url = tpl(String(descriptor.http.urlTemplate), ctx);
    const headers = Object.fromEntries(
      Object.entries(descriptor.http.headers ?? {}).map(([k, v]) => [k, tpl(String(v), ctx)])
    );

    // Only template body when present
    const body =
      descriptor.http.jsonBodyTemplate != null
        ? JSON.stringify(applyTemplate(descriptor.http.jsonBodyTemplate, ctx))
        : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      descriptor.http.timeoutMs ?? 15_000
    );

    const r = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await r.text();
    try {
      const j = JSON.parse(text);
      return NextResponse.json(j, { status: r.status });
    } catch {
      return new NextResponse(text, { status: r.status });
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
