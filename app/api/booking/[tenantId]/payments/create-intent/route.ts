// app/api/booking/[tenantId]/payments/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const body = await req.json();

    // Expect: { tenant_id, reservation_id, amount_cents, currency, customer? }
    const amount_cents = Number(body?.amount_cents);
    const currency: string = (body?.currency || "USD").trim() || "USD";

    if (!Number.isFinite(amount_cents) || amount_cents <= 0) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Invalid amount_cents" },
        { status: 400 }
      );
    }

    // Optionally create/fetch a Customer using reservation/guest info
    const name: string | undefined = body?.customer?.name || undefined;
    const email: string | undefined = body?.customer?.email || undefined;
    const phone: string | undefined = body?.customer?.phone || undefined;

    // You can upsert a real Stripe Customer here; for simplicity we skip it
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount_cents),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        tenant_id: body?.tenant_id ?? tenantId,
        reservation_id: body?.reservation_id ?? "",
      },
      description: `Reservation ${body?.reservation_id ?? ""} (${tenantId})`,
    });

    return NextResponse.json({ ok: true, clientSecret: intent.client_secret });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "server_error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
