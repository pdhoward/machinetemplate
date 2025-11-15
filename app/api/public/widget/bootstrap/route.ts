// app/api/public/widget/bootstrap/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple helper to add CORS headers
function withCORS(json: any, status = 200) {
  return NextResponse.json(json, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*", // or "https://strategicmachines.ai" in prod
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  // CORS preflight handler (even though GET usually doesn’t need it, this is safe)
  return withCORS({}, 204);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      return withCORS(
        { ok: false, error: "missing_widget_key" },
        400
      );
    }

    console.log("[widget-bootstrap] test handler, key =", key);

    // For now, just pretend this is productco
    return withCORS(
      {
        ok: true,
        tenantId: "productco",
        displayName: "Strategic Machines (DEV)",
        branding: {
          primaryColor: "#2563eb",
          logoUrl:
            "https://res.cloudinary.com/stratmachine/image/upload/v1592332360/machine/icon-384x384_liietq.png",
        },
        voiceAgent: {
          agentId: "test-agent-001",
          defaultLanguage: "en-US",
          defaultVoice: "friendly_female",
          maxConversationMinutes: 30,
          fallbackBehavior: "handoff_to_human",
        },
        allowedTools: ["products_search", "products_stats"],
        widgetSessionToken: "dev-test-token",
      },
      200
    );
  } catch (err: any) {
    console.error("[widget-bootstrap] error", err);
    return withCORS(
      { ok: false, error: "server_error" },
      500
    );
  }
}
