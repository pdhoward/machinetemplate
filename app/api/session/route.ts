// app/api/session/route.ts
import { NextResponse } from "next/server";

//const ALLOWED_MODELS = new Set(["gpt-4o-realtime-preview-2024-12-17"]);
const ALLOWED_MODELS = new Set(["gpt-realtime"]);
const ALLOWED_VOICES = new Set(["alloy", "coral"]);

function normalizeTools(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t, i) => {
    const rawName = t?.name ?? "unnamed_tool";
    if (!/^[a-zA-Z0-9_-]+$/.test(rawName)) {
      throw new Error(
        `Tool name "${rawName}" (tools[${i}].name) is invalid. Allowed: ^[a-zA-Z0-9_-]+$`
      );
    }
    const description = t?.description ?? "";
    const parameters =
      t?.parameters && typeof t.parameters === "object"
        ? t.parameters
        : { type: "object", properties: {}, additionalProperties: false };

    return { 
      type: "function", 
      name: rawName, 
      description, 
      parameters,       
    };
  });
}

async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    const body = await safeJson(req);    
    const model =
      ALLOWED_MODELS.has(body.model) ? body.model : "gpt-realtime";
    const voice =
      ALLOWED_VOICES.has(body.voice) ? body.voice : "alloy";

    const tools = normalizeTools(body.tools);

    const payload = {
      model,
      voice,
      modalities: ["audio", "text"],
      instructions: body.instructions ?? "Be helpful and concise.",
      tool_choice: body.tool_choice ?? "auto",
      tools,                                 // <-- normalized
      turn_detection:
        body.turn_detection ?? {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
          create_response: true,
        },
    };

    // Optional diagnostics while debugging:
    // console.debug("[/api/session] payload:", JSON.stringify(payload, null, 2));

    const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      // Optional diagnostics:
      console.error("[/api/session] upstream error:", errText);
      return NextResponse.json({ error: errText }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e: any) {
    // Optional diagnostics:
    // console.error("[/api/session] route error:", e);
    return NextResponse.json({ error: e?.message || "session error" }, { status: 500 });
  }
}


