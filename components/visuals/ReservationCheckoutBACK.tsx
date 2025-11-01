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

/* ─────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */
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

  /** Optional: if provided, used as-is (in cents). */
  amount_cents?: number | string;

  /** Optional: nightly in *base* currency units (e.g. 685 = $685). */
  nightly_rate?: number | string;

  /** Optional */
  nights?: number;

  /** ISO 4217 (defaults to "USD" if missing/blank) */
  currency?: string;

  guest?: Guest;

  /** Optional: if provided, enforces client-side “hold expired” state. */
  hold_expires_at?: string;

  /** Currently: "component_fetches" */
  payment_intent_strategy?: "component_fetches";

  /** Optional per-tenant override */
  publishableKey?: string;

  compact?: boolean;

  /** TEST MODE: no network, no Stripe; simulates success. */
  mock?: boolean;

  /** DEV: bypass intent creation; still renders real Elements. */
  clientSecretOverride?: string;
};

type Phase =
  | "review"                 // Step 1: summary
  | "initializing"           // arming → prepare PaymentIntent
  | "ready_for_payment"      // Elements mounted
  | "confirming_payment"
  | "payment_failed"
  | "expired_hold"
  | "confirming_reservation"
  | "confirmed"
  | "error";

/* ─────────────────────────────────────────────────────────────
 * Utils
 * ──────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    vox?: { say?: (t: string) => void };
  }
}

function say(text: string) {
  try {
    window?.vox?.say?.(text);
  } catch {}
}

function normalizeCurrency(c?: string) {
  const iso = (c ?? "").trim();
  return iso || "USD";
}

function money(amount?: number | string, currency?: string) {
  if (amount == null || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  const iso = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: iso }).format(n);
  } catch {
    return `${Number(n).toFixed(2)} ${iso}`;
  }
}

function parseYmd(ymd?: string) {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return Date.UTC(y, m - 1, d);
}

function nightsBetween(checkIn?: string, checkOut?: string) {
  const a = parseYmd(checkIn);
  const b = parseYmd(checkOut);
  if (a == null || b == null || b <= a) return undefined;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Compute amount in cents using props. */
function computeAmountCents(p: Props): number | undefined {
  if (p.amount_cents != null && p.amount_cents !== "") {
    const n = typeof p.amount_cents === "string" ? Number(p.amount_cents) : p.amount_cents;
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }
  const nights = p.nights ?? nightsBetween(p.check_in, p.check_out);
  if (!nights) return undefined;
  if (p.nightly_rate == null || p.nightly_rate === "") return undefined;
  const nightlyBase = typeof p.nightly_rate === "string" ? Number(p.nightly_rate) : p.nightly_rate;
  if (!Number.isFinite(nightlyBase)) return undefined;
  return Math.round(nightlyBase * nights * 100);
}

/* ─────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────── */
type Stable = {
  tenant_id: string;
  reservation_id: string;
  unit_id: string;
  unit_name?: string;
  check_in: string;
  check_out: string;
  nights?: number;
  nightly_rate?: number;     // base units
  currency: string;          // ISO
  amount_cents?: number;     // cents
  guest?: Guest;
};

export default function ReservationCheckout(props: Props) {
  const [phase, setPhase] = React.useState<Phase>("review");
  const [armed, setArmed] = React.useState(false);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // LATCH: once we see a complete, valid set of essentials for this reservation_id,
  // store them in `stable` so we never regress to "fetching" due to thin payloads later.
  const [stable, setStable] = React.useState<Stable | null>(null);

  // Reset snapshot when switching reservations
  React.useEffect(() => {
    setStable(null);
    setArmed(false);
    setClientSecret(null);
    setErr(null);
    setPhase("review");
  }, [props.reservation_id]);

  // Try to capture a stable snapshot when essentials are present
  React.useEffect(() => {
    const currency = normalizeCurrency(props.currency);
    const nights = props.nights ?? nightsBetween(props.check_in, props.check_out);
    const nightlyBase =
      props.nightly_rate == null
        ? undefined
        : typeof props.nightly_rate === "string"
        ? Number(props.nightly_rate)
        : props.nightly_rate;

    const amt = computeAmountCents(props);

    const essentialsPresent =
      !!props.tenant_id &&
      !!props.check_in &&
      !!props.check_out &&
      (props.amount_cents != null || props.nightly_rate != null);

    if (!stable && essentialsPresent) {
      setStable({
        tenant_id: props.tenant_id,
        reservation_id: props.reservation_id,
        unit_id: props.unit_id,
        unit_name: props.unit_name,
        check_in: props.check_in,
        check_out: props.check_out,
        nights,
        nightly_rate: Number.isFinite(nightlyBase as number) ? (nightlyBase as number) : undefined,
        currency,
        amount_cents: Number.isFinite(amt as number) ? (amt as number) : undefined,
        guest: props.guest,
      });
    }
  }, [
    stable,
    props.tenant_id,
    props.reservation_id,
    props.unit_id,
    props.unit_name,
    props.check_in,
    props.check_out,
    props.nights,
    props.nightly_rate,
    props.amount_cents,
    props.currency,
    props.guest,
  ]);

  // Display model prefers stable snapshot; falls back to live props before latch
  const display = React.useMemo(() => {
    if (stable) return stable;

    const currency = normalizeCurrency(props.currency);
    const nights = props.nights ?? nightsBetween(props.check_in, props.check_out);
    const nightlyBase =
      props.nightly_rate == null
        ? undefined
        : typeof props.nightly_rate === "string"
        ? Number(props.nightly_rate)
        : props.nightly_rate;
    const amt = computeAmountCents(props);

    return {
      tenant_id: props.tenant_id,
      reservation_id: props.reservation_id,
      unit_id: props.unit_id,
      unit_name: props.unit_name,
      check_in: props.check_in,
      check_out: props.check_out,
      nights,
      nightly_rate: Number.isFinite(nightlyBase as number) ? (nightlyBase as number) : undefined,
      currency,
      amount_cents: Number.isFinite(amt as number) ? (amt as number) : undefined,
      guest: props.guest,
    } as Stable;
  }, [stable, props]);

  const hasEverLatched = !!stable;
  const essentialsCurrentlyPresent =
    !!display.tenant_id &&
    !!display.check_in &&
    !!display.check_out &&
    (display.amount_cents != null || display.nightly_rate != null);

  // Publishable key (only needed when we mount Elements)
  const pk = props.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY ?? "";
  const stripePromise = React.useMemo(() => (props.mock ? null : loadStripe(pk)), [props.mock, pk]);

  const titleByPhase: Record<Phase, string> = {
    review: "Review your reservation",
    initializing: "Preparing secure payment…",
    ready_for_payment: "Review & complete your payment",
    confirming_payment: "Confirming payment…",
    payment_failed: "Payment not approved",
    expired_hold: "Reservation hold expired",
    confirming_reservation: "Finalizing your reservation",
    confirmed: "Reservation confirmed",
    error: "Checkout unavailable",
  };

  // Hold expiration gate (before arming)
  React.useEffect(() => {
    if (phase !== "review") return;
    if (!props.hold_expires_at) return;
    const exp = new Date(props.hold_expires_at).getTime();
    if (Date.now() > exp) {
      setPhase("expired_hold");
      say("This hold appears to have expired. We can place a new hold if you’d like.");
    }
  }, [phase, props.hold_expires_at]);

  // Armed → create PaymentIntent (or mock/override)
  React.useEffect(() => {
    if (!armed) return;

    let cancelled = false;

    async function initSecurePayment() {
      try {
        setErr(null);
        setPhase("initializing");

        if (!essentialsCurrentlyPresent) {
          throw new Error("Reservation details are incomplete. Please go back and try again.");
        }

        // Require amount at arm time unless mock
        if (!props.mock && (!Number.isFinite(display.amount_cents as number) || (display.amount_cents as number) <= 0)) {
          throw new Error("Missing or invalid total amount.");
        }

        // TEST MODE: no network, no Stripe
        if (props.mock) {
          if (!cancelled) {
            setClientSecret("pi_client_secret_mock_dev");
            setPhase("ready_for_payment");
          }
          return;
        }

        // DEV override: skip backend intent; still mount Elements
        if (props.clientSecretOverride) {
          if (!cancelled) {
            setClientSecret(props.clientSecretOverride);
            setPhase("ready_for_payment");
          }
          return;
        }

        // REAL: create PaymentIntent on backend
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 12_000);

        const intentRes = await fetch(
          `/api/booking/${encodeURIComponent(display.tenant_id)}/payments/create-intent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "Idempotency-Key": display.reservation_id || "reservation-unknown",
            },
            signal: controller.signal,
            body: JSON.stringify({
              tenant_id: display.tenant_id,
              reservation_id: display.reservation_id,
              amount_cents: display.amount_cents, // hint; server should recompute trusted total
              currency: display.currency,
              customer: {
                name: `${display.guest?.first_name ?? ""} ${display.guest?.last_name ?? ""}`.trim(),
                email: display.guest?.email,
                phone: display.guest?.phone,
              },
            }),
          }
        ).catch((e) => {
          if (e?.name === "AbortError") {
            throw new Error("Network timeout while preparing checkout. Please try again.");
          }
          throw e;
        });

        clearTimeout(abortTimer);

        if (!intentRes.ok) {
          const j = await intentRes.json().catch(() => ({}));
          const hint = j?.hint || "Unable to start a secure payment session.";
          throw new Error(hint);
        }

        const data = await intentRes.json();
        const cs = data?.clientSecret;
        if (!cs || typeof cs !== "string") throw new Error("Missing clientSecret.");

        if (!cancelled) {
          setClientSecret(cs);
          setPhase("ready_for_payment");
        }
      } catch (e: any) {
        if (!cancelled) {
          setPhase("error");
          setErr(e?.message ?? "We couldn’t initialize checkout.");
          say("I couldn’t start a secure payment session. Let’s try again.");
        }
      }
    }

    initSecurePayment();
    return () => {
      cancelled = true;
    };
  }, [armed, essentialsCurrentlyPresent, props.mock, props.clientSecretOverride, display]);

  function friendlyStripeError(e: any): string {
    const code = e?.code as string | undefined;
    if (code === "card_declined") return "That card was declined. Try a different one.";
    if (code === "incomplete_number") return "Please complete your card number.";
    if (code === "incomplete_cvc") return "Please enter your card security code.";
    if (code === "incomplete_expiry") return "Please enter your card’s expiration date.";
    return e?.message || "The card wasn’t approved.";
  }

  const headerTitle = titleByPhase[phase];

  return (
    <Card
      key={props.reservation_id} // ensure clean reset on reservation switch
      className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]"
    >
      <CardHeader className={props.compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{headerTitle}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400 space-y-0.5">
          <div>Unit: {display.unit_name ?? display.unit_id}</div>
          <div>Dates: {display.check_in} → {display.check_out}</div>
          <div>
            Nightly: {money(display.nightly_rate, display.currency)} &nbsp;·&nbsp; Nights: {display.nights ?? "—"}
          </div>
          <div>
            Total:&nbsp;
            {Number.isFinite((display.amount_cents as number) / 100)
              ? money((display.amount_cents as number) / 100, display.currency)
              : "—"}
          </div>
          {phase === "expired_hold" && <div className="text-amber-400">The hold window has passed.</div>}
          {phase === "payment_failed" && <div className="text-red-400">Please try a different card.</div>}
          {phase === "error" && err ? <div className="text-red-400">{err}</div> : null}
        </CardDescription>
      </CardHeader>

      <CardContent className={props.compact ? "px-4 pt-0 pb-4" : undefined}>
        {/* STEP 1: REVIEW (never regresses to "fetching" once latched) */}
        {phase === "review" && (
          <>
            {hasEverLatched || essentialsCurrentlyPresent ? (
              <div className="grid gap-3">
                <div className="text-sm text-neutral-300">
                  Please confirm your stay details. When ready, continue to a secure payment form.
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      // Validate at arm-time
                      if (!essentialsCurrentlyPresent) {
                        setErr("Reservation details are incomplete. Please try again.");
                        setPhase("error");
                        return;
                      }
                      if (!props.mock && (!Number.isFinite(display.amount_cents as number) || (display.amount_cents as number) <= 0)) {
                        setErr("Missing or invalid total amount.");
                        setPhase("error");
                        return;
                      }
                      if (!props.mock && !(props.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY)) {
                        setErr("Missing publishable key. Set NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY or pass publishableKey.");
                        setPhase("error");
                        return;
                      }
                      setArmed(true);
                    }}
                  >
                    Continue to secure payment
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-400">We’re fetching your reservation details…</div>
            )}
          </>
        )}

        {/* PREP (armed, creating PaymentIntent) */}
        {phase === "initializing" && (
          <div className="text-sm text-neutral-400">Preparing your secure payment session…</div>
        )}

        {/* MOCK Elements substitute */}
        {props.mock && phase === "ready_for_payment" && (
          <MockPaymentBox
            amountCents={(display.amount_cents as number) ?? 0}
            currency={display.currency}
            phase={phase}
            setPhase={setPhase}
            setErr={setErr}
          />
        )}

        {/* REAL Elements mount */}
        {!props.mock &&
          clientSecret &&
          (phase === "ready_for_payment" || phase === "confirming_payment" || phase === "payment_failed") && (
            <Elements
              stripe={stripePromise!}
              options={{ clientSecret, appearance: { theme: "night" } }}
            >
              <CheckoutElementsForm
                {...props}
                amount_cents={(display.amount_cents as number) ?? 0}
                currency={display.currency}
                clientSecret={clientSecret}
                phase={phase}
                setPhase={setPhase}
                setErr={(m) => {
                  if (m) setPhase("payment_failed");
                  setErr(m);
                }}
                friendlyStripeError={friendlyStripeError}
              />
            </Elements>
          )}

        {/* Expired hold affordance */}
        {phase === "expired_hold" && (
          <Button
            className="mt-2"
            onClick={() => {
              say("Would you like me to place a new hold for those dates?");
            }}
          >
            Place a new hold
          </Button>
        )}

        {/* Error recovery → back to REVIEW and clear armed/clientSecret */}
        {phase === "error" && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setErr(null);
                setClientSecret(null);
                setArmed(false);
                setPhase("review");
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {phase === "confirmed" && (
          <div className="text-sm text-neutral-300">
            Your reservation is confirmed. A confirmation email has been sent.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
 * REAL Stripe Elements form
 * ──────────────────────────────────────────────────────────── */
function CheckoutElementsForm({
  tenant_id,
  reservation_id,
  amount_cents,
  currency,
  guest,
  phase,
  setPhase,
  setErr,
  friendlyStripeError,
}: Props & {
  clientSecret: string;
  phase: Phase;
  setPhase: (p: Phase) => void;
  setErr: (s: string | null) => void;
  friendlyStripeError: (e: any) => string;
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
      const msg = friendlyStripeError(error);
      setPhase("payment_failed");
      setErr(msg);
      say(msg);
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

    try {
      setPhase("confirming_reservation");
      // Place your finalize call here if/when added:
      // const res = await fetch(`/api/booking/${encodeURIComponent(tenant_id)}/confirm`, {...});
      // if (!res.ok) throw new Error("Unable to finalize reservation.");

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

/* ─────────────────────────────────────────────────────────────
 * TEST MODE ONLY (no Stripe, no network)
 * ──────────────────────────────────────────────────────────── */
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
          say("Your payment was approved and the reservation is confirmed. (mock)");
        }, 600);
      }}
    >
      <div className="bg-neutral-950 border border-dashed border-neutral-700 rounded p-3 text-sm text-neutral-400">
        <div className="font-medium text-neutral-200 mb-1">Mock card entry</div>
        <div className="opacity-80">
          No network calls made. Clicking the button will simulate a successful payment and confirmation.
        </div>
        <div className="mt-2">
          Charge:&nbsp;{money(amountCents / 100, currency)}
        </div>
      </div>
      <Button type="submit" className="mt-1 w-full">
        {phase === "confirming_reservation" ? "Processing…" : "Simulate Pay & Confirm"}
      </Button>
    </form>
  );
}
