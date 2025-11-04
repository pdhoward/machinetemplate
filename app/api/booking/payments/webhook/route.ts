import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import getMongoConnection from "@/db/connections";
import { ObjectId } from "mongodb";

export const runtime = "nodejs"; // Stripe SDK needs Node

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text(); // string is fine for constructEvent

  // Toggle secret based on environment
  const endpointSecret = process.env.NODE_ENV === 'development' 
    ? process.env.STRIPE_VOX_WH_SECRET_DEV!
    : process.env.STRIPE_VOX_WH_SECRET_PROD!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      endpointSecret
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;

      // Now safe to access metadata (type is narrowed to PaymentIntent)
      const tenantId = pi.metadata?.tenant_id; // Fix key to 'tenant_id' (lowercase)
      if (!tenantId) {
        console.error("[stripe webhook] missing tenant_id in metadata");
        return NextResponse.json({ received: true }, { status: 200 }); // Or return 400 if you want to error
      }

      const reservationId = (pi.metadata?.reservation_id as string) || null;

      if (reservationId) {
        const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
        const Reservations = db.collection("reservations");
        const _id = new ObjectId(reservationId);

        await Reservations.updateOne(
          { _id },
          { $set: { status: "confirmed", updatedAt: new Date() } }
        );
      }
    } else {
      // Optional: Log unhandled events but acknowledge to prevent retries
      console.log(`Unhandled event type: ${event.type}`);
    }

    // Optional: handle other events (payment_failed, refunds, etc.)
    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[stripe webhook] error:", e);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}