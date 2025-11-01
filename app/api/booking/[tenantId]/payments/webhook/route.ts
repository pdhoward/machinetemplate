// app/api/booking/[tenantId]/payments/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import getMongoConnection from "@/db/connections";
import { ObjectId } from "mongodb";

export const runtime = "nodejs"; // Stripe SDK needs Node

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const sig = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text(); // string is fine for constructEvent

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
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
    }

    // Optional: handle other events (payment_failed, refunds, etc.)
    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[stripe webhook] error:", e);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}
