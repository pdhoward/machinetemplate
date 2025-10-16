// app/api/tools/payments/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PaymentsCreateIntentInput } from "@/types/tools";
import getMongoConnection from "@/db/connections";

const stripe = new Stripe(process.env.STRIPE_VOX_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PaymentsCreateIntentInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 400 });
    }
    const { tenant_id, amount_cents, currency, reservation_id, customer } = parsed.data;

    // create/reuse customer (optional)
    let customerId: string | undefined;
    if (customer?.email) {
      const search = await stripe.customers.search({
        query: `email:'${customer.email.replace(/'/g, "\\'")}' AND metadata['tenantId']:'${tenant_id}'`,
      });
      customerId = search.data[0]?.id;
      if (!customerId) {
        const created = await stripe.customers.create({
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          metadata: { tenantId: tenant_id },
        });
        customerId = created.id;
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency,
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { tenantId: tenant_id, reservationId: reservation_id ?? "" },
    });

    // upsert a pending payment row
    const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
    await db.collection("payments").updateOne(
      { stripePaymentIntentId: intent.id },
      {
        $setOnInsert: {
          tenantId: tenant_id,
          reservationId: reservation_id ?? null,
          amountCents: amount_cents,
          currency,
          createdAt: new Date(),
        },
        $set: { status: intent.status, updatedAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      status: intent.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "server_error" }, { status: 500 });
  }
}
