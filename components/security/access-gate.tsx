// components/security/access-gate.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  LockKeyhole,
  Mail,
  RotateCcw,
  LogOut,
  Loader2,
} from "lucide-react";
import { decodeJwt } from "jose";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/context/tenant-context";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

type Stage = "email" | "otp" | "done";
type VisualState = "default" | "error" | "success";

export function AccessGate() {
  const { tenantId, token, setToken } = useTenant();

  // popover open/close state so it behaves like a dropdown
  const [open, setOpen] = useState(false);

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP as single string (input-otp supports it)
  const [otp, setOtp] = useState("");
  const isSix = /^\d{6}$/.test(otp);

  // server supplies this after sending
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const isAuthed = useMemo(() => Boolean(token), [token]);
  const visualState: VisualState = error ? "error" : stage === "done" ? "success" : "default";

  // simple resend cooldown (in seconds)
  const [cooldown, setCooldown] = useState(0);

  // decode token (display only)
  const decodedEmail = useMemo(() => {
    if (!token) return null;
    try {
      const claims = decodeJwt(token) as { email?: string | undefined };
      return claims.email ?? null;
    } catch {
      return null;
    }
  }, [token]);

  useEffect(() => {
    if (isAuthed) {
      setStage("done");
    }
  }, [isAuthed]);

  // Auto-verify once 6 digits entered
  useEffect(() => {
    if (stage === "otp" && isSix && !verifying) {
      verify(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, stage]);

  // countdown effect for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function maskEmail(v: string | null) {
    if (!v) return "";
    const [user, domain] = v.split("@");
    if (!user || !domain) return v;
    const maskedUser =
      user.length <= 2
        ? user[0] + "*"
        : user[0] + "*".repeat(user.length - 2) + user[user.length - 1];
    return `${maskedUser}@${domain}`;
  }

  async function sendEmail() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email, tenantId }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Email failed");
      setChallengeToken(data.challengeToken);
      setStage("otp");
      setOtp(""); // reset digits
      setCooldown(30); // simple resend throttle
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function verify(code: string) {
    if (!challengeToken) return;
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code, challengeToken, tenantId }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Verification failed");
      // cookie is also set server-side; mirror to context for client logic
      setToken(data.sessionToken);
      setStage("done");
      // auto-close after a moment
      setTimeout(() => setOpen(false), 600);
    } catch (e: any) {
      setError(e.message);
      setOtp("");
    } finally {
      setVerifying(false);
    }
  }

  async function signOut() {
    setError(null);
    setSigningOut(true);
    try {
      fetch("/api/transcripts/finalize", { method: "POST" }), // capture transcripts
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (e: any) {
      // even if API errors, clear local token so UI locks down
    } finally {
      setSigningOut(false);
      setToken(null);
      setStage("email");
      setOtp("");
      setEmail("");
      setError(null);
      setChallengeToken(null);
      setCooldown(0);
      setOpen(false);
    }
  }

  function onEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && email && !sending) {
      e.preventDefault();
      sendEmail();
    }
  }

  const signedInAs = email || decodedEmail || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={isAuthed ? "Tenant access granted" : "Open access gate"}
          className="flex items-center gap-2 max-md:h-9 max-md:w-9 max-md:px-0"
        >
          {isAuthed ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="hidden md:inline text-xs">Activated</span>
            </>
          ) : (
            <>
              <LockKeyhole className="h-4 w-4" />
              <span className="hidden md:inline text-xs">Access</span>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[22rem] p-4" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4" />
            <p className="text-sm font-medium">
              {stage === "done" ? "Agent Activated" : "Activate Agent"}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {stage === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                <p className="text-xs text-muted-foreground">
                  Enter your email to receive a 6-digit code.
                </p>
                <div className="relative">
                  <Mail className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-8 h-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={onEmailKeyDown}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" onClick={sendEmail} disabled={!email || sending}>
                    {sending ? "Sending…" : "Send code"}
                  </Button>
                </div>
              </motion.div>
            )}

            {stage === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-medium">{maskEmail(email)}</span>.
                </p>

                <div className="flex items-center gap-2">
                  <InputOTP
                    aria-label="Enter 6-digit code"
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    state={visualState as any}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} state={visualState as any} />
                      <InputOTPSlot index={1} state={visualState as any} />
                      <InputOTPSlot index={2} state={visualState as any} />
                      <InputOTPSeparator className="mx-1 opacity-60" />
                      <InputOTPSlot index={3} state={visualState as any} />
                      <InputOTPSlot index={4} state={visualState as any} />
                      <InputOTPSlot index={5} state={visualState as any} />
                    </InputOTPGroup>
                  </InputOTP>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                    onClick={sendEmail}
                    disabled={cooldown > 0 || sending}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setStage("email");
                      setOtp("");
                      setError(null);
                    }}
                    disabled={verifying}
                  >
                    Use a different email
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => isSix && !verifying && verify(otp)}
                    disabled={!isSix || verifying}
                  >
                    {verifying ? "Verifying…" : "Verify"}
                  </Button>
                </div>
              </motion.div>
            )}

            {stage === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                {signedInAs && (
                  <p className="text-xs text-muted-foreground">
                    Signed in as <span className="font-medium">{maskEmail(signedInAs)}</span>
                  </p>
                )}

                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Access granted</span>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={signOut}
                    disabled={signingOut}
                    className="inline-flex items-center gap-2"
                  >
                    {signingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing out…
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div className="text-[11px] text-red-500 font-medium">{error}</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
