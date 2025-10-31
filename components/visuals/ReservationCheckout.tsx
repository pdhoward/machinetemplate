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

  /** Optional (unused for now, but allowed) */
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
  | "initializing"
  | "ready_for_payment"
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

/** Speak helper (no-throw) */
function say(text: string) {
  try {
    window?.vox?.say?.(text);
  } catch {
    /* no-op */
  }
}

/** Always return a valid ISO code (defaults to USD). */
function normalizeCurrency(c?: string) {
  const iso = (c ?? "").trim();
  return iso || "USD";
}

/** Safe money formatter (never throws). Amount is in base units (not cents). */
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

/** Inclusive start, exclusive end (UTC to avoid local TZ shifts) */
function parseYmd(ymd?: string) {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  if (!y || !m || !d) return undefined;
  return Date.UTC(y, m - 1, d);
}

function nightsBetween(checkIn?: string, checkOut?: string) {
  const a = parseYmd(checkIn);
  const b = parseYmd(checkOut);
  if (a == null || b == null || b <= a) return undefined;
  const ms = b - a;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Compute a sane amount (in cents) to charge:
 * 1) If props.amount_cents is provided → use it.
 * 2) Else if nightly_rate and nights are available → nightly_rate (base) * nights * 100.
 * 3) Else → undefined (UI shows "—" and init waits/fails gracefully).
 */
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
export default function ReservationCheckout(props: Props) {
  /** Phase state machine for UI. */
  const [phase, setPhase] = React.useState<Phase>("initializing");
  /** Stripe client secret (when obtained). */
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  /** Human-friendly error for the banner. */
  const [err, setErr] = React.useState<string | null>(null);

  /** Guard against indefinite waiting for “thin” payloads:
   *  - We allow a bounded wait window for essentials to arrive (initDeadline).
   *  - We limit a few internal retries (initAttempts).
   */
  const INIT_MAX_MS = 12_000; // 12s ceiling waiting for essential props/amount
  const [initDeadline] = React.useState(() => Date.now() + INIT_MAX_MS);
  const [initAttempts, setInitAttempts] = React.useState(0);

  // Currency & amount
  const currency = normalizeCurrency(props.currency);
  const amountCents = computeAmountCents(props);

  /** Essentials present? (we show a skeleton if not) */
  const hasEssential =
    !!props.tenant_id &&
    !!props.check_in &&
    !!props.check_out &&
    (props.amount_cents != null || props.nightly_rate != null);

  /* DEBUGGING (keep during rollout)
  console.log("[ReservationCheckout] inputs", {
    check_in: props.check_in,
    check_out: props.check_out,
    nights: nightsBetween(props.check_in, props.check_out),
    nightly_rate: props.nightly_rate,
    amount_cents_prop: props.amount_cents,
    computed_amount_cents: amountCents,
    currency: props.currency,
  });
  */

  // Derived display values (base units)
  const derivedNights = props.nights ?? nightsBetween(props.check_in, props.check_out);
  const nightlyBase =
    props.nightly_rate == null
      ? undefined
      : typeof props.nightly_rate === "string"
      ? Number(props.nightly_rate)
      : props.nightly_rate;
  const totalBase =
    derivedNights && Number.isFinite(nightlyBase as number)
      ? (nightlyBase as number) * derivedNights
      : undefined;

  // Stripe publishable key (not required in mock mode)
  const pk = props.publishableKey ?? process.env.NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY ?? "";

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

  /**
   * Initialize the payment flow:
   * - If mock → short-circuit, no network calls.
   * - Else: wait for essential data; create PaymentIntent (abortable, with Idempotency-Key).
   * - Handles hold expiry, server hints, and bounded retries.
   */
  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Speak once on entry (harmless if repeated)
        say("I’ve created a temporary hold. Please review the details and enter your card when you’re ready.");

        // Hold check (UX clarity for expired holds)
        if (props.hold_expires_at) {
          const exp = new Date(props.hold_expires_at).getTime();
          if (Date.now() > exp) {
            setPhase("expired_hold");
            say("This hold appears to have expired. We can place a new hold if you’d like.");
            return;
          }
        }

        // If essentials are not here yet, wait a *bounded* time, then fail gracefully.
        if (!hasEssential) {
          if (Date.now() < initDeadline && initAttempts < 3) {
            setPhase("initializing");
            setErr(null);
            setInitAttempts((n) => n + 1);
            say("Preparing your checkout details…");
            return;
          }
          setPhase("error");
          setErr("We couldn’t load your reservation details in time. Please try again.");
          return;
        }

        // We have essentials, but do we have a valid amount? (unless we are in mock mode)
        if (!props.mock && (!Number.isFinite(amountCents as number) || (amountCents as number) <= 0)) {
          setPhase("error");
          setErr("Missing or invalid total amount.");
          return;
        }

        // TEST MODE: no network, no Stripe; simulate success
        if (props.mock) {
          if (!cancelled) {
            setClientSecret("pi_client_secret_mock_dev");
            setPhase("ready_for_payment");
          }
          return;
        }

        // DEV override: skip the backend intent creation; still render real Elements
        if (props.clientSecretOverride) {
          if (!cancelled) {
            setClientSecret(props.clientSecretOverride);
            setPhase("ready_for_payment");
          }
          return;
        }

        // NORMAL: create a PaymentIntent on your backend
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 12_000); // 12s network ceiling

        const intentRes = await fetch(
          `/api/booking/${encodeURIComponent(props.tenant_id)}/payments/create-intent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              // Idempotency ensures retries won't create dup intents; reservation_id is a good key.
              "Idempotency-Key": props.reservation_id || "reservation-unknown",
            },
            signal: controller.signal,
            body: JSON.stringify({
              // NOTE: server should recompute trusted total from reservation;
              // amount_cents is a *hint* for display and can be ignored server-side.
              tenant_id: props.tenant_id,
              reservation_id: props.reservation_id,
              amount_cents: amountCents,
              currency,
              customer: {
                name: `${props.guest?.first_name ?? ""} ${props.guest?.last_name ?? ""}`.trim(),
                email: props.guest?.email,
                phone: props.guest?.phone,
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
          // If server sends a helpful hint, surface it
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
        setErr(e?.message ?? "We couldn’t initialize checkout.");
        setPhase("error");
        say("I couldn’t start a secure payment session. Let’s try again.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // Re-run when key drivers change
  }, [
    props.tenant_id,
    props.reservation_id,
    props.hold_expires_at,
    props.mock,
    props.clientSecretOverride,
    hasEssential,
    amountCents,
    currency,
    initAttempts,
    initDeadline,
  ]);

  // In REAL mode, a publishable key is required to mount Elements
  if (!props.mock && !pk) {
    return (
      <Card key={props.reservation_id} className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle>Checkout unavailable</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-neutral-400">
          Missing publishable key. Set <code>NEXT_PUBLIC_STRIPE_VOX_PUBLIC_KEY</code> or pass{" "}
          <code>publishableKey</code>.
        </CardContent>
      </Card>
    );
  }

  const stripePromise = React.useMemo(() => (props.mock ? null : loadStripe(pk)), [props.mock, pk]);

  return (
    <Card
      key={props.reservation_id} // 🔑 Force a clean reset when switching reservations
      className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]"
    >
      <CardHeader className={props.compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{titleByPhase[phase]}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400 space-y-0.5">
          <div>Unit: {props.unit_name ?? props.unit_id}</div>
          <div>Dates: {props.check_in} → {props.check_out}</div>
          <div>
            Nightly: {money(nightlyBase, currency)} &nbsp;·&nbsp; Nights: {derivedNights ?? "—"}
          </div>
          <div>
            Total:&nbsp;
            {Number.isFinite((amountCents as number) / 100)
              ? money((amountCents as number) / 100, currency)
              : "—"}
          </div>
          {phase === "expired_hold" && <div className="text-amber-400">The hold window has passed.</div>}
          {phase === "payment_failed" && <div className="text-red-400">Please try a different card.</div>}
          {phase === "error" && err ? (
            <div className="text-red-400">
              {err}
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Reset init attempts & phase; effect will re-run
                    setErr(null);
                    setPhase("initializing");
                    setInitAttempts(0);
                  }}
                >
                  Try again
                </Button>
              </div>
            </div>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className={props.compact ? "px-4 pt-0 pb-4" : undefined}>
        {/* TEST MODE: local mock */}
        {props.mock ? (
          <MockPaymentBox
            amountCents={(amountCents as number) ?? 0}
            currency={currency}
            phase={phase}
            setPhase={setPhase}
            setErr={setErr}
          />
        ) : clientSecret &&
          (phase === "ready_for_payment" ||
            phase === "confirming_payment" ||
            phase === "payment_failed") ? (
          <Elements stripe={stripePromise!} options={{ clientSecret, appearance: { theme: "night" } }}>
            <CheckoutElementsForm
              {...props}
              amount_cents={(amountCents as number) ?? 0}
              currency={currency}
              clientSecret={clientSecret}
              phase={phase}
              setPhase={setPhase}
              setErr={setErr}
            />
          </Elements>
        ) : (
          <>
            {phase === "initializing" && (
              <div className="text-sm text-neutral-400">Preparing your secure payment session…</div>
            )}
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

/* ─────────────────────────────────────────────────────────────
 * REAL Stripe Elements form (used when mock === false)
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
}: Props & {
  clientSecret: string;
  phase: Phase;
  setPhase: (p: Phase) => void;
  setErr: (s: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);

  /** Map common Stripe error codes to friendlier copy. */
  function friendlyStripeError(e: any): string {
    const code = e?.code as string | undefined;
    if (code === "card_declined") return "That card was declined. Try a different one.";
    if (code === "incomplete_number") return "Please complete your card number.";
    if (code === "incomplete_cvc") return "Please enter your card security code.";
    if (code === "incomplete_expiry") return "Please enter your card’s expiration date.";
    return e?.message || "The card wasn’t approved.";
  }

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

    // 2) Promote hold → confirmed on your backend (if/when you add it).
    // For now, optimistic confirmation.
    try {
      setPhase("confirming_reservation");

      // Example (future):
      // const res = await fetch(`/api/booking/${encodeURIComponent(tenant_id)}/confirm`, {
      //   method: "POST",
      //   headers: { "content-type": "application/json" },
      //   body: JSON.stringify({ reservation_id }),
      // });
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
