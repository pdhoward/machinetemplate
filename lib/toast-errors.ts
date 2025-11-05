// lib/toast-errors.ts

type ToastParams = {
  title: string;
  description: string;
  variant: "error" | "default"; // Updated to match sonner variants; 'destructive' maps to 'error'
};

export function getToastParams(
  code?: string,
  userMessage?: string,
  retryAfter?: number,
  fallback?: string
): ToastParams {
  const wait = retryAfter && retryAfter > 0 ? `${retryAfter}s` : "a moment";

  switch (code) {
    case "DAILY_QUOTA":
      return { title: "Daily limit reached", description: userMessage ?? "Please try again tomorrow or contact us for help.", variant: "error" };
    case "CONCURRENT_SESSIONS":
      return { title: "Already connected", description: userMessage ?? "Close the other session, then try again.", variant: "error" };
    case "RATE_LIMIT_USER":
    case "RATE_LIMIT_IP":
    case "RATE_LIMIT_SESSION":
      return { title: "Too many requests", description: userMessage ?? `Please wait ${wait} and try again.`, variant: "error" };
    case "AUTH_REQUIRED":
      return { title: "Please sign in", description: userMessage ?? "Your session expired. Sign in and try again.", variant: "error" };
    case "BOT_BLOCKED":
      return { title: "Verification failed", description: userMessage ?? "Refresh and try again.", variant: "error" };
    case "SESSION_ERROR":
      return { title: "Couldn’t start session", description: userMessage ?? (fallback ?? "Please try again."), variant: "error" };
    default:
      return { title: "Unknown error", description: userMessage ?? (fallback ?? "An unexpected error occurred. Please try again."), variant: "error" }; // Updated default for unknown errors
  }
}

/** Get toast params for any thrown error (plain Error/string). */
export function getToastParamsFromUnknownError(err: any): ToastParams {
  const msg = (err?.message || String(err || "")).toLowerCase();

  if (msg.includes("quota exceeded")) {
    return { title: "Daily limit reached", description: "Please try again tomorrow or contact us.", variant: "error" };
  }
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return { title: "Too many requests", description: "Please wait a moment and try again.", variant: "error" };
  }
  if (msg.includes("no ephemeral token") || msg.includes("session error") || msg.includes("auth")) {
    return { title: "Please sign in", description: "Your session expired. Sign in and try again.", variant: "error" };
  }
  if (msg.includes("permission") || msg.includes("notallowederror")) {
    return { title: "Microphone permission needed", description: "Allow mic access to start the voice session.", variant: "error" };
  }
  return { title: "Couldn’t connect", description: "We couldn’t start the voice session. Please try again.", variant: "error" };
}