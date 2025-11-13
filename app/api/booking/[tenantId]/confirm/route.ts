// app/api/booking/[tenantId]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import getMongoConnection from "@/db/connections";
import { ObjectId } from "mongodb";
import { checkBotId } from "botid/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST(req: NextRequest) {

  // 1) Bot check - suspicious automation
  const verdict = await checkBotId();
   if (verdict.isBot && !verdict.isVerifiedBot) {
    return NextResponse.json(
        { error: "Bot verification failed", code: "BOT_BLOCKED",
          userMessage: "We couldn’t verify this device. Please refresh and try again." },
        { status: 403 }
      );
  }
  try {
    const { reservation_id, payment_intent_id } = await req.json();

    if (!reservation_id || !payment_intent_id) {
      return NextResponse.json({ error: "Missing reservation_id or payment_intent_id" }, { status: 400 });
    }

    // 1) Retrieve PI from Stripe (source of truth)
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== "succeeded") {
      return NextResponse.json({ error: "PaymentIntent not succeeded" }, { status: 409 });
    } 

    // 2) Update reservation → confirmed (idempotent)
    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    const Reservations = db.collection("reservations");
    let _id;
    try {
      _id = new ObjectId(String(reservation_id)); // Use new ObjectId() for hex string IDs (standard MongoDB format)
    } catch (idErr) {
      console.error("Invalid reservation_id:", idErr);
      return NextResponse.json({ error: "Invalid reservation_id format" }, { status: 400 });
    }

    const doc = await Reservations.findOne({ _id });
    if (!doc) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Optional sanity checks (amount/currency match)
    // const expectedCents = doc.rate * nights * 100; // depends on your schema
    // if (pi.amount !== expectedCents || pi.currency !== (doc.currency || "usd").toLowerCase()) { ... }

      // HANDLED BY WEBHOOK
      //   if (doc.status !== "confirmed") {
      //     await Reservations.updateOne(
      //       { _id },
      //       { $set: { status: "confirmed", updatedAt: new Date() } }
      //     );
      //   }

     return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[confirm] error:", e);
    return NextResponse.json({ error: e?.message || "confirm error" }, { status: 500 });
  }
}