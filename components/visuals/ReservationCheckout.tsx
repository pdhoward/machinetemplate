// components/visuals/ReservationCheckout.tsx
"use client";

import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Guest = { first_name?: string; last_name?: string; email?: string; phone?: string };
type Money = { amount_cents: number; currency: string };
type Props = {
  tenant_id: string;
  reservation_id: string;
  unit_id: string;
  unit_name?: string;
  check_in: string;
  check_out: string;
  nights?: number;
  nightly_rate?: number;
  fees_cents?: number;
  taxes_cents?: number;
  amount_cents: number | string;
  currency: string;
  guest?: Guest;
  hold_expires_at?: string;           // ISO
  payment_intent_strategy?: "component_fetches";
  publishableKey?: string;            // optional per-tenant override
  compact?: boolean;
};

type Phase =
  | "initializing"          // creating PaymentIntent / fetching clientSecret
  | "ready_for_payment"     // Elements is ready
  | "confirming_payment"    // stripe.confirmPayment in-flight
  | "payment_failed"        // payment failure (retry allowed)
  | "expired_hold"          // backend hold expired
  | "confirming_reservation"// promoting hold → confirmed
  | "confirmed"             // final
  | "error";                // generic error state

declare global {
  interface Window {
    vox?: { say?: (t: string) => void };
  }
}

function say(text: string) {
  try { window?.vox?.say?.(text); } catch { /* no-op */ }
}

export default function ReservationCheckout(props: Props) {
  const [phase, setPhase] = React.useState<Phase>("initializing");
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const amountCents = typeof props.amount_cents === "string" ? Number(props.amount_cents) : props.amount_cents;
  const pk = props.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY;

  // Prefetch clientSecret on mount
  React.useEffect(() => {
    let cancelled = false;

    async function go() {
      try {
        say("I’ve created a temporary hold. Please review the details and enter your card when you’re ready.");
        // Guard: hold expiry (optional—you can also poll periodically)
        if (props.hold_expires_at) {
          const exp = new Date(props.hold_expires_at).getTime();
          if (Date.now() > exp) {
            setPhase("expired_hold");
            say("This hold appears to have expired. We can place a new hold if you’d like.");
            return;
          }
        }

        // 1) Create PaymentIntent
        const res = await fetch(
          `/api/booking/${encodeURIComponent(props.tenant_id)}/payments/create-intent`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              tenant_id: props.tenant_id,
              reservation_id: props.reservation_id,
              amount_cents: amountCents,
              currency: props.currency,
              customer: {
                name: `${props.guest?.first_name ?? ""} ${props.guest?.last_name ?? ""}`.trim(),
                email: props.guest?.email,
                phone: props.guest?.phone,
              },
            }),
          }
        );

        if (!res.ok) throw new Error("Unable to start a secure payment session.");
        const data = await res.json();
        const cs = data?.clientSecret;
        if (!cs || typeof cs !== "string") throw new Error("Missing clientSecret.");
        if (cancelled) return;

        setClientSecret(cs);
        setPhase("ready_for_payment");
      } catch (e: any) {
        setErr(e?.message ?? "We couldn’t initialize checkout.");
        setPhase("error");
        say("I couldn’t start a secure payment session. Let’s try again.");
      }
    }

    go();
    return () => { cancelled = true; };
  }, [props.tenant_id, props.reservation_id, amountCents, props.currency]);

  if (!pk) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader><CardTitle>Checkout unavailable</CardTitle></CardHeader>
        <CardContent className="text-sm text-neutral-400">
          Missing publishable key. Set <code>NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY</code> or pass <code>publishableKey</code>.
        </CardContent>
      </Card>
    );
  }

  const stripePromise = React.useMemo(() => loadStripe(pk), [pk]);

  // Header text by phase
  const titleByPhase: Record<Phase, string> = {
    initializing: "Setting up your checkout",
    ready_for_payment: "Review & complete your payment",
    confirming_payment: "Confirming payment…",
    payment_failed: "Payment not approved",
    expired_hold: "Reservation hold expired",
    confirming_reservation: "Finalizing your reservation",
    confirmed: "Reservation confirmed",
    error: "Checkout unavailable",
  };

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={props.compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{titleByPhase[phase]}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400 space-y-0.5">
          <div>Unit: {props.unit_name ?? props.unit_id}</div>
          <div>Dates: {props.check_in} → {props.check_out}</div>
          <div>
            Total:&nbsp;
            {new Intl.NumberFormat(undefined, { style: "currency", currency: props.currency })
              .format(amountCents / 100)}
          </div>
          {phase === "expired_hold" && <div className="text-amber-400">The hold window has passed.</div>}
          {phase === "payment_failed" && <div className="text-red-400">Please try a different card.</div>}
          {phase === "error" && err ? <div className="text-red-400">{err}</div> : null}
        </CardDescription>
      </CardHeader>

      <CardContent className={props.compact ? "px-4 pt-0 pb-4" : undefined}>
        {clientSecret && (phase === "ready_for_payment" || phase === "confirming_payment" || phase === "payment_failed") ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
            <CheckoutElementsForm
              {...props}
              amount_cents={amountCents}
              clientSecret={clientSecret}
              phase={phase}
              setPhase={setPhase}
              setErr={setErr}
            />
          </Elements>
        ) : (
          <>
            {phase === "initializing" && <div className="text-sm text-neutral-400">Preparing your secure payment session…</div>}
            {phase === "expired_hold" && (
              <Button
                className="mt-2"
                onClick={() => {
                  // Optional: emit an action for the agent to place a new hold
                  say("Would you like me to place a new hold for those dates?");
                }}
              >
                Place a new hold
              </Button>
            )}
            {phase === "confirmed" && (
              <div className="text-sm text-neutral-300">
                Your reservation is confirmed. A confirmation email has been sent.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CheckoutElementsForm({
  tenant_id,
  reservation_id,
  amount_cents,
  currency,
  guest,
  phase,
  setPhase,
  setErr,
}: Props & {
  clientSecret: string;
  phase: Phase;
  setPhase: (p: Phase) => void;
  setErr: (s: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setPhase("confirming_payment");
    setErr(null);

    // 1) Confirm payment with Stripe (handles SCA)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: `${guest?.first_name ?? ""} ${guest?.last_name ?? ""}`.trim() || undefined,
            email: guest?.email,
            phone: guest?.phone,
          },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      setPhase("payment_failed");
      setErr(error.message || "The card wasn’t approved.");
      say("That card wasn’t approved. You can try a different card.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status !== "succeeded") {
      setPhase("payment_failed");
      setErr("Payment did not complete.");
      say("I couldn’t complete that payment. You can try again.");
      setSubmitting(false);
      return;
    }

    // 2) Promote hold → confirmed on your backend
    try {
      setPhase("confirming_reservation");
      const res = await fetch(
        `https://cypressbooking.vercel.app/api/booking/${encodeURIComponent(tenant_id)}/reserve`,
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: undefined as any }, // <- your reverse proxy should handle auth; or use a secure server endpoint you expose to the client
          body: JSON.stringify({ reservation_id, confirmed: true }),
        }
      );

      if (!res.ok) throw new Error("Unable to finalize reservation.");
      // Optionally read the response here for display; we simply flip UI:
      setPhase("confirmed");
      say("Your payment was approved and the reservation is confirmed. I’ve emailed your confirmation.");
    } catch (e: any) {
      setPhase("error");
      setErr(e?.message || "We couldn’t finalize the reservation.");
      say("I couldn’t finalize the reservation just now. Let’s try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="bg-neutral-950 border border-neutral-800 rounded p-3">
        <PaymentElement />
      </div>
      <Button type="submit" disabled={!stripe || !elements || submitting} className="mt-1 w-full">
        {submitting ? "Processing…" : "Pay & Confirm"}
      </Button>
    </form>
  );
}
