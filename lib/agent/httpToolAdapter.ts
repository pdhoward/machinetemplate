// lib/agent/httpToolAdapter.ts
type HttpToolDesc = {
  name: string;
  description?: string;
  parameters: any; // JSON schema
  http: {
    method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE";
    urlTemplate: string;         // e.g. ".../booking/{tenant_id}/quote?unit_id={unit_id}..."
    bodyTemplate?: any;          // for POST/PUT/PATCH (object with handlebars-like placeholders)
    headers?: Record<string,string>;
    okField?: string;            // e.g., "ok"
  };
};

export function hydrateHttpTool(
  d: HttpToolDesc,
  resolveSecret: (k: string) => string|undefined
) {
  const fill = (tmpl: string, args: any) =>
    tmpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(args[k] ?? ""));

  const fillObj = (obj: any, args: any): any => {
    if (obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(v => fillObj(v, args));
    const out: any = {};
    for (const [k,v] of Object.entries(obj)) {
      if (typeof v === "string") {
        // replace {{secrets.key}} and {arg}
        const withArgs = v.replace(/\{(\w+)\}/g, (_, key) => String(args[key] ?? ""));
        out[k] = withArgs.replace(/\{\{secrets\.([\w_-]+)\}\}/g, (_, skey) => resolveSecret(skey) ?? "");
      } else {
        out[k] = fillObj(v, args);
      }
    }
    return out;
  };

  return async function toolImpl(args: any) {
    const url = fill(d.http.urlTemplate, args);
    const headers = d.http.headers ? fillObj(d.http.headers, args) : {};
    const init: RequestInit = { method: d.http.method, headers };

    if (d.http.bodyTemplate) {
      init.body = JSON.stringify(fillObj(d.http.bodyTemplate, args));
    }

    const resp = await fetch(url, init);
    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) return { ok: false, ...json, status: resp.status };
    if (d.http.okField && json && typeof json === "object") {
      const ok = Boolean(json[d.http.okField]);
      return ok ? { ok: true, ...json } : { ok: false, ...json };
    }
    return { ok: true, ...json };
  };
}
