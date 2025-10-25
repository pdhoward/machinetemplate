// components/visuals/ReservationCheckout.tsx
"use client";

import React from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */
type Guest = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

type Props = {
  tenant_id: string;
  reservation_id: string;
  unit_id: string;
  unit_name?: string;
  check_in: string;
  check_out: string;
  nights?: number;
  nightly_rate?: number; // cents
  fees_cents?: number;
  taxes_cents?: number;
  amount_cents: number | string;
  currency: string;
  guest?: Guest;
  hold_expires_at?: string; // ISO
  payment_intent_strategy?: "component_fetches";
  publishableKey?: string; // optional per-tenant override
  compact?: boolean;

  /** TEST MODE: if true, NO network calls, NO Stripe. Local mock flow only. */
  mock?: boolean;

  /**
   * TEST/DEV: If provided, bypasses the create-intent fetch and uses this string as the client secret.
   * Stripe Elements still renders in this mode (not used if mock === true).
   */
  clientSecretOverride?: string;
};

type Phase =
  | "initializing"
  | "ready_for_payment"
  | "confirming_payment"
  | "payment_failed"
  | "expired_hold"
  | "confirming_reservation"
  | "confirmed"
  | "error";

/** ──────────────────────────────────────────────────────────────────────────
 * Optional voice helper
 * ────────────────────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    vox?: { say?: (t: string) => void };
  }
}
function say(text: string) {
  try {
    window?.vox?.say?.(text);
  } catch {
    /* no-op */
  }
}

/** ──────────────────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────────────────── */
export default function ReservationCheckout(props: Props) {
  const [phase, setPhase] = React.useState<Phase>("initializing");
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const amountCents =
    typeof props.amount_cents === "string"
      ? Number(props.amount_cents)
      : props.amount_cents;

  console.log("[ReservationCheckout].", props);
  // Stripe publishable key is NOT required in TEST MODE (mock === true).
  const pk =
    props.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY ?? "";

  // Title by phase
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

  /** ────────────────────────────────────────────────────────────────────────
   * TEST MODE SHORT-CIRCUIT:
   * - If mock === true: skip all network calls and Stripe entirely.
   * - If clientSecretOverride is provided: skip create-intent fetch and use it.
   * Otherwise: do the normal "create-intent" fetch.
   * ─────────────────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        say(
          "I’ve created a temporary hold. Please review the details and enter your card when you’re ready."
        );

        // Optional hold-expiry check (also applies to test mode)
        if (props.hold_expires_at) {
          const exp = new Date(props.hold_expires_at).getTime();
          if (Date.now() > exp) {
            setPhase("expired_hold");
            say(
              "This hold appears to have expired. We can place a new hold if you’d like."
            );
            return;
          }
        }

        // ── TEST MODE: fully local, no Stripe, no network ─────────────────
        if (props.mock) {
          if (!cancelled) {
            setClientSecret("pi_client_secret_mock_dev"); // sentinel string
            setPhase("ready_for_payment");
          }
          return;
        }

        // ── DEV MODE: skip fetch; still render real Stripe Elements ───────
        if (props.clientSecretOverride) {
          if (!cancelled) {
            setClientSecret(props.clientSecretOverride);
            setPhase("ready_for_payment");
          }
          return;
        }

        // ── PRODUCTION / NORMAL DEV: fetch client secret ──────────────────
        const res = await fetch(
          `/api/booking/${encodeURIComponent(
            props.tenant_id
          )}/payments/create-intent`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              tenant_id: props.tenant_id,
              reservation_id: props.reservation_id,
              amount_cents: amountCents,
              currency: props.currency,
              customer: {
                name: `${props.guest?.first_name ?? ""} ${
                  props.guest?.last_name ?? ""
                }`.trim(),
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

        if (!cancelled) {
          setClientSecret(cs);
          setPhase("ready_for_payment");
        }
      } catch (e: any) {
        setErr(e?.message ?? "We couldn’t initialize checkout.");
        setPhase("error");
        say("I couldn’t start a secure payment session. Let’s try again.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [
    props.tenant_id,
    props.reservation_id,
    amountCents,
    props.currency,
    props.hold_expires_at,
    props.mock, // TEST MODE flag in deps
    props.clientSecretOverride, // TEST MODE override in deps
  ]);

  // In REAL mode, we require a publishable key; in TEST MODE (mock) we do not.
  if (!props.mock && !pk) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle>Checkout unavailable</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-400">
          Missing publishable key. Set{" "}
          <code>NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY</code> or pass{" "}
          <code>publishableKey</code>.
        </CardContent>
      </Card>
    );
  }

  // Only construct Stripe in REAL/Elements mode.
  const stripePromise = React.useMemo(
    () => (props.mock ? null : loadStripe(pk)),
    [props.mock, pk]
  );

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={props.compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{titleByPhase[phase]}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400 space-y-0.5">
          <div>Unit: {props.unit_name ?? props.unit_id}</div>
          <div>
            Dates: {props.check_in} → {props.check_out}
          </div>
          <div>
            Total:&nbsp;
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: props.currency,
            }).format(amountCents / 100)}
          </div>
          {phase === "expired_hold" && (
            <div className="text-amber-400">The hold window has passed.</div>
          )}
          {phase === "payment_failed" && (
            <div className="text-red-400">Please try a different card.</div>
          )}
          {phase === "error" && err ? (
            <div className="text-red-400">{err}</div>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className={props.compact ? "px-4 pt-0 pb-4" : undefined}>
        {/* ────────────────────────────────────────────────────────────────
            TEST MODE RENDER: local mock, no Stripe, no network
           ─────────────────────────────────────────────────────────────── */}
        {props.mock ? (
          <MockPaymentBox
            amountCents={amountCents}
            currency={props.currency}
            phase={phase}
            setPhase={setPhase}
            setErr={setErr}
          />
        ) : clientSecret &&
          (phase === "ready_for_payment" ||
            phase === "confirming_payment" ||
            phase === "payment_failed") ? (
          <Elements
            stripe={stripePromise!}
            options={{ clientSecret, appearance: { theme: "night" } }}
          >
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
            {phase === "initializing" && (
              <div className="text-sm text-neutral-400">
                Preparing your secure payment session…
              </div>
            )}
            {phase === "expired_hold" && (
              <Button
                className="mt-2"
                onClick={() => {
                  say(
                    "Would you like me to place a new hold for those dates?"
                  );
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

/** ──────────────────────────────────────────────────────────────────────────
 * REAL Stripe Elements form (used when mock === false)
 * ────────────────────────────────────────────────────────────────────────── */
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
            name:
              `${guest?.first_name ?? ""} ${guest?.last_name ?? ""}`.trim() ||
              undefined,
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
        `https://cypressbooking.vercel.app/api/booking/${encodeURIComponent(
          tenant_id
        )}/reserve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // NOTE: Use a secure reverse proxy or server-only auth
            authorization: undefined as any,
          },
          body: JSON.stringify({ reservation_id, confirmed: true }),
        }
      );

      if (!res.ok) throw new Error("Unable to finalize reservation.");
      setPhase("confirmed");
      say(
        "Your payment was approved and the reservation is confirmed. I’ve emailed your confirmation."
      );
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
      <Button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="mt-1 w-full"
      >
        {submitting ? "Processing…" : "Pay & Confirm"}
      </Button>
    </form>
  );
}

/** ──────────────────────────────────────────────────────────────────────────
 * TEST MODE ONLY: Local mock payment box (no Stripe, no network)
 * - Simulates a successful payment + confirmation.
 * ────────────────────────────────────────────────────────────────────────── */
function MockPaymentBox({
  amountCents,
  currency,
  phase,
  setPhase,
  setErr,
}: {
  amountCents: number;
  currency: string;
  phase: Phase;
  setPhase: (p: Phase) => void;
  setErr: (s: string | null) => void;
}) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setPhase("confirming_reservation");
        setTimeout(() => {
          setPhase("confirmed");
          say(
            "Your payment was approved and the reservation is confirmed. (mock)"
          );
        }, 600);
      }}
    >
      <div className="bg-neutral-950 border border-dashed border-neutral-700 rounded p-3 text-sm text-neutral-400">
        <div className="font-medium text-neutral-200 mb-1">Mock card entry</div>
        <div className="opacity-80">
          No network calls made. Clicking the button will simulate a successful
          payment and confirmation.
        </div>
        <div className="mt-2">
          Charge:&nbsp;
          {new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
          }).format(amountCents / 100)}
        </div>
      </div>
      <Button type="submit" className="mt-1 w-full">
        {phase === "confirming_reservation" ? "Processing…" : "Simulate Pay & Confirm"}
      </Button>
    </form>
  );
}
