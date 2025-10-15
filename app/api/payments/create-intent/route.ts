// app/api/payments/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import getMongoConnection  from "@/db/connections";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

export async function POST(req: NextRequest) {
  try {
    const { tenantId, reservationId, amountCents, currency = "USD", customer } = await req.json();

    if (!tenantId || !amountCents) {
      return NextResponse.json({ error: "tenantId and amountCents are required" }, { status: 400 });
    }

    // (Optional) create/reuse a Stripe Customer keyed by email+tenant
    let customerId: string | undefined;
    if (customer?.email) {
      const search = await stripe.customers.search({
        query: `email:'${customer.email.replace(/'/g, "\\'")}' AND metadata['tenantId']:'${tenantId}'`,
      });
      const existing = search.data[0];
      if (existing) {
        customerId = existing.id;
      } else {
        const created = await stripe.customers.create({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { tenantId },
        });
        customerId = created.id;
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        tenantId,
        reservationId: reservationId ?? "",
      },
    });

    // (Optional) record a pending payment doc
    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    await db.collection("payments").insertOne({
      tenantId,
      reservationId: reservationId ?? null,
      stripePaymentIntentId: intent.id,
      status: intent.status,
      amountCents,
      currency,
      customerEmail: customer?.email ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "server_error" }, { status: 500 });
  }
}
