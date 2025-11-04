// lib/toast-errors.ts
export const TOASTED = Symbol("toasted-error");

export class ToastedError extends Error {
  [TOASTED] = true as const;
  constructor(message: string) {
    super(message);
    this.name = "ToastedError";
  }
}

type ShowToast = (p: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;

function titleDesc(
  code?: string,
  userMessage?: string,
  retryAfter?: number,
  fallback?: string
): { title: string; description: string; variant?: "destructive" } {
  const wait = retryAfter && retryAfter > 0 ? `${retryAfter}s` : "a moment";

  switch (code) {
    case "DAILY_QUOTA":
      return { title: "Daily limit reached", description: userMessage ?? "Please try again tomorrow or contact us for help.", variant: "destructive" };
    case "CONCURRENT_SESSIONS":
      return { title: "Already connected", description: userMessage ?? "Close the other session, then try again.", variant: "destructive" };
    case "RATE_LIMIT_USER":
    case "RATE_LIMIT_IP":
    case "RATE_LIMIT_SESSION":
      return { title: "Too many requests", description: userMessage ?? `Please wait ${wait} and try again.`, variant: "destructive" };
    case "AUTH_REQUIRED":
      return { title: "Please sign in", description: userMessage ?? "Your session expired. Sign in and try again.", variant: "destructive" };
    case "BOT_BLOCKED":
      return { title: "Verification failed", description: userMessage ?? "Refresh and try again.", variant: "destructive" };
    case "SESSION_ERROR":
      return { title: "Couldn’t start session", description: userMessage ?? (fallback ?? "Please try again."), variant: "destructive" };
    default:
      return { title: "We couldn’t start a secure session", description: userMessage ?? (fallback ?? "Please try again."), variant: "destructive" };
  }
}

/** Show a toast for a structured API error payload, then throw a ToastedError. */
export function toastFromApiErrorAndThrow(
  toast: ShowToast,
  payload: { code?: string; userMessage?: string; retryAfter?: number; error?: string },
  fallbackStatus?: number
): never {
  const { code, userMessage, retryAfter, error } = payload || {};
  const { title, description, variant } = titleDesc(code, userMessage, retryAfter, fallbackStatus === 429 ? "Please wait a moment and try again." : undefined);
  toast({ title, description, variant });
  throw new ToastedError(error || title);
}

/** Map any thrown error (plain Error/string) to a single toast (idempotent), no throw. */
export function toastFromUnknownErrorOnce(err: any, toast: ShowToast) {
  if (err && err[TOASTED]) return; // already shown
  const msg = (err?.message || String(err || "")).toLowerCase();

  if (msg.includes("quota exceeded")) {
    toast({ title: "Daily limit reached", description: "Please try again tomorrow or contact us.", variant: "destructive" });
    return;
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    toast({ title: "Too many requests", description: "Please wait a moment and try again.", variant: "destructive" });
    return;
  }
  if (msg.includes("no ephemeral token") || msg.includes("session error") || msg.includes("auth")) {
    toast({ title: "Please sign in", description: "Your session expired. Sign in and try again.", variant: "destructive" });
    return;
  }
  if (msg.includes("permission") || msg.includes("notallowederror")) {
    toast({ title: "Microphone permission needed", description: "Allow mic access to start the voice session.", variant: "destructive" });
    return;
  }
  toast({ title: "Couldn’t connect", description: "We couldn’t start the voice session. Please try again.", variant: "destructive" });
}
