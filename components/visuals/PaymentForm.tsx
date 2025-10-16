// components/visuals/PaymentForm.tsx
"use client";

import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type PaymentFormProps = {
  tenantId: string;
  reservationId?: string;
  amountCents: number;
  currency?: string;
  /** Optional: agent-provided guest info; not rendered, only sent to Stripe at confirm */
  prefill?: { name?: string; email?: string; phone?: string };
  /** Optional: if the agent/tool pre-created an intent */
  clientSecret?: string;
  /** Callback after successful confirmation */
  onPaid?: (info: { paymentIntentId: string }) => void;
  compact?: boolean;
};

export default function PaymentForm(props: PaymentFormProps) {
  const [clientSecret, setClientSecret] = React.useState<string | undefined>(
    props.clientSecret
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create a PaymentIntent if one wasn't provided
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (props.clientSecret) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            tenantId: props.tenantId,
            reservationId: props.reservationId,
            amountCents: props.amountCents,
            currency: props.currency ?? "USD",
            customer: {
              name: props.prefill?.name,
              email: props.prefill?.email,
              phone: props.prefill?.phone,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create PaymentIntent");
        if (mounted) setClientSecret(json.clientSecret);
      } catch (e: any) {
        if (mounted) setError(e.message || "Could not initialize payment.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    props.clientSecret,
    props.tenantId,
    props.reservationId,
    props.amountCents,
    props.currency,
    props.prefill?.name,
    props.prefill?.email,
    props.prefill?.phone,
  ]);

  // Loading/initialization state
  if (!clientSecret) {
    return (
      <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
        <CardHeader className={props.compact ? "px-4 py-3" : undefined}>
          <CardTitle className="text-base sm:text-lg">Complete your payment</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-neutral-400">
            {loading ? "Initializing secure payment…" : "Unable to start payment."}
          </CardDescription>
        </CardHeader>
        <CardContent className={props.compact ? "px-4 pt-0 pb-4" : undefined}>
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "night" },
      }}
    >
      <InnerPaymentForm {...props} clientSecret={clientSecret} />
    </Elements>
  );
}

function InnerPaymentForm({
  clientSecret,
  reservationId,
  amountCents,
  currency = "USD",
  prefill,
  onPaid,
  compact,
}: PaymentFormProps & { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const formatMoney = (cents: number, iso: string) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: iso,
    }).format(cents / 100);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErr(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // silently include guest details already collected by voice agent
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
        <CardDescription className="text-xs sm:text-sm text-neutral-400">
          Amount:{" "}
          <span className="font-medium text-neutral-200">
            {formatMoney(amountCents, currency)}
          </span>
          {reservationId ? (
            <span className="ml-2 text-neutral-500">(Reservation {reservationId})</span>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <form className="grid gap-3" onSubmit={submit}>
          {/* The Payment Element renders its own inline labels/placeholders */}
          <div className="bg-neutral-950 border border-neutral-800 rounded p-3">
            <PaymentElement />
          </div>

          {err ? <div className="text-sm text-red-400">{err}</div> : null}

          <Button type="submit" disabled={!stripe || submitting} className="mt-1 w-full">
            {submitting ? "Processing…" : "Pay now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
