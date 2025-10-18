// components/visuals/PaymentForm.tsx
"use client";

import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Prefill = { name?: string; email?: string; phone?: string };
type Summary = { unit?: string; checkIn?: string; checkOut?: string };

export type PaymentFormProps = {
  tenantId: string;
  reservationId?: string;
  amountCents: number;
  currency?: string;
  clientSecret?: string;          // REQUIRED (provided by your HTTP tool)
  prefill?: Prefill;
  summary?: Summary;
  publishableKey?: string;        // optional per-tenant override
  onPaid?: (info: { paymentIntentId: string }) => void;
  compact?: boolean;
};

// ---- NEVER call useStripe/useElements here ----
export default function PaymentForm(props: PaymentFormProps) {
  // 1) publishable key
  const pk = props.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY;
  if (!pk) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle>Payment unavailable</CardTitle></CardHeader>
        <CardContent className="text-sm text-neutral-400">
          Missing <code>NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY</code> or <code>publishableKey</code> prop.
        </CardContent>
      </Card>
    );
  }

  // 2) must have clientSecret (tool should provide it)
  const hasRequired =
    !!props.tenantId &&
    Number.isFinite(props.amountCents) &&
    props.amountCents > 0 &&
    typeof props.clientSecret === "string" &&
    props.clientSecret.length > 0;

  if (!hasRequired) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle>Payment setup incomplete</CardTitle>
          <CardDescription className="text-neutral-400">
            This form requires a <code>clientSecret</code> (create via booking_collect_payment tool),
            plus <code>tenantId</code> and positive <code>amountCents</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // 3) create Stripe instance once
  const stripePromise = React.useMemo(() => loadStripe(pk), [pk]);

  // 4) Only now render <Elements>; hooks live *under* this.
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret: props.clientSecret!, appearance: { theme: "night" } }}
    >
      <ConfirmedElementsForm {...props} />
    </Elements>
  );
}

// ---- Hooks live only under <Elements> ----
function ConfirmedElementsForm({
  reservationId,
  amountCents,
  currency = "USD",
  prefill,
  onPaid,
  compact,
  summary,
}: Omit<PaymentFormProps, "clientSecret" | "tenantId" | "amountCents"> & { amountCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const formatMoney = (cents: number, iso: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: iso }).format(cents / 100);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return; // if Elements hasn’t mounted yet
    setSubmitting(true);
    setErr(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: prefill?.name,
            email: prefill?.email,
            phone: prefill?.phone,
          },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      setErr(error.message || "Unable to confirm payment.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onPaid?.({ paymentIntentId: paymentIntent.id });
    }
    setSubmitting(false);
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Complete your payment</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400 space-y-0.5">
          {summary?.unit ? <div>Unit: {summary.unit}</div> : null}
          {summary?.checkIn && summary?.checkOut ? (
            <div>Dates: {summary.checkIn} → {summary.checkOut}</div>
          ) : null}
          <div>
            Amount: <span className="font-medium text-neutral-200">{formatMoney(amountCents, currency)}</span>
            {reservationId ? <span className="ml-2 text-neutral-500">(Reservation {reservationId})</span> : null}
          </div>
        </CardDescription>
      </CardHeader>

      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <form className="grid gap-3" onSubmit={submit}>
          <div className="bg-neutral-950 border border-neutral-800 rounded p-3">
            <PaymentElement />
          </div>
          {err ? <div className="text-sm text-red-400">{err}</div> : null}
          <Button type="submit" disabled={!stripe || !elements || submitting} className="mt-1 w-full">
            {submitting ? "Processing…" : "Pay now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
