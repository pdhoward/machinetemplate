// components/visualizer.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import { useTenant } from "@/context/tenant-context";
import { decodeJwt } from "jose"; // decode only; verification handled server-side

type VisualizerProps = {
  volume: number;            // RMS from useWebRTC (assistant audio)
  isConnected: boolean;
  onStart: () => void;       // call connect()
  onEnd: () => void;         // call disconnect()
  barsCount?: number;        // optional (default 48)
};

type AuthState = "loading" | "valid" | "invalid";

export default function Visualizer({
  volume,
  isConnected,
  onStart,
  onEnd,
  barsCount = 48,
}: VisualizerProps) {
  const { token } = useTenant();
  const [auth, setAuth] = useState<AuthState>("loading");

  // Optional: decode for a nicer tooltip (no verification here)
  const claims = useMemo(() => {
    if (!token) return null;
    try { return decodeJwt(token) as { email?: string; tenantId?: string }; }
    catch { return null; }
  }, [token]);

  // Verify token status via server (secure). Your /api/auth/session already jwt.verifies.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) {
        if (alive) setAuth("invalid");
        return;
      }
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        setAuth(data?.token ? "valid" : "invalid");
      } catch {
        if (alive) setAuth("invalid");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // ---------- Visualizer Bars ----------
  const [bars, setBars] = useState<number[]>(() => Array(barsCount).fill(6));
  const threshold = 0.003; // small RMS threshold for animation

  // precompute bar x positions (symmetrical)
  const positions = useMemo(() => {
    const left = Array.from({ length: barsCount / 2 }, (_, i) => -i - 1);
    const right = Array.from({ length: barsCount / 2 }, (_, i) => i);
    return [...left.reverse(), ...right];
  }, [barsCount]);

  useEffect(() => {
    if (!isConnected) {
      setBars(Array(barsCount).fill(6));
      return;
    }
    if (volume > threshold) {
      setBars(() =>
        Array.from({ length: barsCount }, () => {
          const jitter = Math.random() * 0.9 + 0.1;
          const h = Math.min(90, Math.max(6, volume * 1200 * jitter));
          return h;
        })
      );
    } else {
      setBars(() => Array.from({ length: barsCount }, () => 6 + Math.random() * 4));
    }
  }, [volume, isConnected, barsCount]);

  const pulse =
    isConnected && volume <= threshold
      ? {
          scale: [1, 1.08, 1],
          opacity: [1, 0.9, 1],
          transition: { duration: 0.9, repeat: Infinity },
        }
      : {};

  // ---------- Buttons ----------
  const btnBase =
    "inline-flex items-center justify-center rounded-full text-white w-10 h-10 shadow-lg focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed";
  const btnGreen = `${btnBase} bg-green-600 hover:bg-green-500`;
  const btnRed = `${btnBase} bg-red-600 hover:bg-red-500`;
  const btnGrey = `${btnBase} bg-neutral-600 hover:bg-neutral-600`;

  const canStart = auth === "valid" && !isConnected;

  const startTitle =
    auth === "loading"
      ? "Checking access…"
      : auth === "invalid"
      ? "Sign in via Access to activate"
      : claims?.email
      ? `Start call as ${claims.email}`
      : "Start call";

  return (
    <div className="flex flex-col items-center justify-center">
      <AnimatePresence>
        {isConnected && (
          <motion.div
            key="viz"
            className="flex items-center justify-center w-full"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
          >
            <svg
              width="100%"
              height="120"
              viewBox="0 0 1000 120"
              preserveAspectRatio="xMidYMid meet"
            >
              {bars.map((h, idx) => {
                const step = 1000 / bars.length;
                const cw = 6;
                const gap = step - cw;
                const center = 500;
                const xCenterIdx = positions[idx];
                const x = center + xCenterIdx * (cw + gap);
                const y = 60 - h / 2;
                return (
                  <rect
                    key={idx}
                    x={x}
                    y={y}
                    width={cw}
                    height={h}
                    className={`fill-current ${
                      isConnected ? "text-white/80" : "text-neutral-500/40"
                    }`}
                    rx={2}
                    ry={2}
                  />
                );
              })}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="mt-3" animate={pulse as any}>
        {isConnected ? (
          <button
            onClick={onEnd}
            className={btnRed}
            aria-label="End call"
            title="End Call"
          >
            <PhoneOff size={18} />
          </button>
        ) : (
          <button
            onClick={canStart ? onStart : undefined}
            className={canStart ? btnGreen : btnGrey}
            aria-label="Start call"
            title={startTitle}
            disabled={!canStart}
          >
            <Phone size={18} />
          </button>
        )}
      </motion.div>

      {/* Optional tiny status hint */}
      {!isConnected && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {auth === "loading"
            ? "Verifying access…"
            : auth === "invalid"
            ? "Open Access in Navbar to sign in"
            : claims?.tenantId
            ? `Tenant: ${claims.tenantId}`
            : null}
        </div>
      )}
    </div>
  );
}
