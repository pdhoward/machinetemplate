// app/api/payments/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import getMongoConnection  from "@/db/connections";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const buf = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    // We care about PI lifecycle events
    if (event.type.startsWith("payment_intent.")) {
      const pi = event.data.object as Stripe.PaymentIntent;

      // ✅ Re-fetch with expand to get card details safely
      const full = await stripe.paymentIntents.retrieve(pi.id, {
        expand: ["latest_charge.payment_method_details", "customer"],
      });

      const latestCharge = full.latest_charge as Stripe.Charge | null;
      const card = latestCharge?.payment_method_details?.card;
      const cardBrand = card?.brand ?? null;
      const last4 = card?.last4 ?? null;

      const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
      await db.collection("payments").updateOne(
        { stripePaymentIntentId: full.id },
        {
          $set: {
            status: full.status,
            updatedAt: new Date(),
            cardBrand,
            last4,
            customerId: typeof full.customer === "string" ? full.customer : full.customer?.id ?? null,
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    return new NextResponse(`Webhook handler failed: ${e.message}`, { status: 500 });
  }
}
