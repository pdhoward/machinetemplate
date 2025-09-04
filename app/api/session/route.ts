// app/api/session/route.ts
import { NextResponse } from "next/server";

const ALLOWED_MODELS = new Set(["gpt-4o-realtime-preview-2024-12-17"]);
const ALLOWED_VOICES = new Set(["alloy", "coral"]);

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    const body = await safeJson(req);
    const model = ALLOWED_MODELS.has(body.model) ? body.model : "gpt-4o-realtime-preview-2024-12-17";
    const voice = ALLOWED_VOICES.has(body.voice) ? body.voice : "alloy";

    const payload = {
      model,
      voice,
      modalities: ["audio", "text"],
      instructions: body.instructions ?? "Be helpful and concise.",
      tool_choice: body.tool_choice ?? "auto",
      tools: Array.isArray(body.tools) ? body.tools : [],
      // optional: start with server VAD
      turn_detection: body.turn_detection ?? {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 200,
        create_response: true,
      },
    };

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
      return NextResponse.json({ error: errText }, { status: resp.status });
    }
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "session error" }, { status: 500 });
  }
}

async function safeJson(req: Request) { try { return await req.json(); } catch { return {}; } }
