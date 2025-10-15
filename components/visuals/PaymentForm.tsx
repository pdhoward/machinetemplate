// components/visuals/payment-form.tsx
"use client";

import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type PaymentFormProps = {
  tenantId: string;               // 👈 required so the API can scope the intent
  reservationId?: string;
  amountCents: number;            // integer cents
  currency?: string;              // default "USD"
  prefill?: { name?: string; email?: string; phone?: string };
  clientSecret?: string;          // optional (if provided by the agent/tool)
  onPaid?: (info: { paymentIntentId: string }) => void;
  compact?: boolean;
};

export default function PaymentForm(props: PaymentFormProps) {
  const [clientSecret, setClientSecret] = React.useState<string | undefined>(props.clientSecret);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // If clientSecret not provided, create it once
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (props.clientSecret) return;
      setLoading(true);
      setError(null);
      try {
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
        if (!res.ok) throw new Error(json.error || "Failed to create PaymentIntent");
        if (mounted) setClientSecret(json.clientSecret);
      } catch (e: any) {
        if (mounted) setError(e.message || "Could not initialize payment.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [props.clientSecret, props.tenantId, props.reservationId, props.amountCents, props.currency, props.prefill?.name, props.prefill?.email, props.prefill?.phone]);

  if (!clientSecret) {
    return (
      <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
        <CardHeader className={props.compact ? "px-4 py-3" : undefined}>
          <CardTitle className="text-base sm:text-lg">Complete your payment</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-neutral-400">
            Initializing secure payment…
          </CardDescription>
        </CardHeader>
        <CardContent className={props.compact ? "px-4 pt-0 pb-4" : undefined}>
          {error ? <div className="text-sm text-red-400">{error}</div> : <div className="text-sm text-neutral-300">{loading ? "Loading…" : "Unable to start payment."}</div>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
      <InnerPaymentForm
        {...props}
        clientSecret={clientSecret}
        onPaid={props.onPaid}
      />
    </Elements>
  );
}

function InnerPaymentForm({
  clientSecret,
  prefill,
  reservationId,
  amountCents,
  currency = "USD",
  onPaid,
  compact,
}: PaymentFormProps & { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();

  const [name, setName] = React.useState(prefill?.name ?? "");
  const [email, setEmail] = React.useState(prefill?.email ?? "");
  const [phone, setPhone] = React.useState(prefill?.phone ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErr(null);

    // Confirm the payment without leaving the page
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // If you use a redirect flow, add a return_url here
        payment_method_data: {
          billing_details: { name, email, phone },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      setErr(error.message || "Unable to confirm payment.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      onPaid?.({ paymentIntentId: paymentIntent.id });
      setSubmitting(false);
      return;
    }

    // Other statuses (e.g., requires_action) will be auto-handled by Payment Element UI if needed
    setSubmitting(false);
  };

  const formatMoney = (cents: number, iso: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: iso }).format(cents / 100);

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Complete your payment</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">
          Amount: <span className="font-medium text-neutral-200">{formatMoney(amountCents, currency)}</span>
          {reservationId ? <span className="ml-2 text-neutral-500">(Reservation {reservationId})</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <form className="grid gap-3" onSubmit={submit}>
          {/* Minimal contact fields (no address) */}
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-xs sm:text-sm">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone" className="text-xs sm:text-sm">Phone (optional)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {/* Stripe secure Payment Element (card details live here) */}
          <div className="grid gap-2">
            <Label className="text-xs sm:text-sm">Card details</Label>
            <div className="bg-neutral-950 border border-neutral-800 rounded p-3">
              <PaymentElement />
            </div>
          </div>

          {err ? <div className="text-sm text-red-400">{err}</div> : null}

          <Button type="submit" disabled={!stripe || submitting} className="mt-3 w-full">
            {submitting ? "Processing…" : "Pay now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
