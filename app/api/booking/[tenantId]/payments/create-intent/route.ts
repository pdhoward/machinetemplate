// app/api/booking/[tenantId]/payments/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { checkBotId } from "botid/server";

export const runtime = "nodejs"; // Stripe SDK needs Node (not Edge)

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST( req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  
  const verdict = await checkBotId();
  //debugging:
  console.log("BotID verdict", verdict);

  if (verdict.isBot && !verdict.isVerifiedBot && !verdict.bypassed) {
  return NextResponse.json(
    {
      error: "Bot verification failed",
      code: "BOT_BLOCKED",
      userMessage: "We couldn’t verify this device. Please refresh and try again.",
    },
    { status: 403 }
  );
}

  
  try {
    const { tenantId } = await params;
    const body = await req.json();

    // Expect: { tenant_id, reservation_id, amount_cents, currency, customer? }
    const reservationId: string = body?.reservation_id || "";
    const amountCents = Number(body?.amount_cents);
    const currency = String(body?.currency || "USD").trim().toLowerCase(); // stripe expects lowercase

    if (!reservationId) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Missing reservation_id" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Invalid amount_cents" },
        { status: 400 }
      );
    }

    // Optional: attach customer details
    const name: string | undefined = body?.customer?.name || undefined;
    const email: string | undefined = body?.customer?.email || undefined;
    const phone: string | undefined = body?.customer?.phone || undefined;

    // NOTE: You can upsert a Stripe Customer here if desired.
    // For now, rely on automatic payment methods and optional billing_details.

    // Idempotency: 1 PI per reservation_id
    const intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amountCents),
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: {
          tenant_id: body?.tenant_id ?? tenantId,
          reservation_id: reservationId,
          customer_name: name || "",
          customer_email: email || "",
          customer_phone: phone || "",
        },
        description: `Reservation ${reservationId} (${tenantId})`,
      },
      { idempotencyKey: reservationId }
    );

    return NextResponse.json({
      ok: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
