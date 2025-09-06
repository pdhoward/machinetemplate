"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";

type VisualizerProps = {
  volume: number;                // RMS from useWebRTC (assistant audio)
  isConnected: boolean;
  onStart: () => void;           // call connect()
  onEnd: () => void;             // call disconnect()
  barsCount?: number;            // optional (default 48)
};

export default function Visualizer({
  volume,
  isConnected,
  onStart,
  onEnd,
  barsCount = 48,
}: VisualizerProps) {
  const [bars, setBars] = useState<number[]>(() => Array(barsCount).fill(6));
  const threshold = 0.003; // small RMS threshold for animation

  // precompute bar x positions (symmetrical)
  const positions = useMemo(() => {
    const left = Array.from({ length: barsCount / 2 }, (_, i) => -i - 1);
    const right = Array.from({ length: barsCount / 2 }, (_, i) => i);
    return [...left.reverse(), ...right]; // symmetrical from center
  }, [barsCount]);

  useEffect(() => {
    if (!isConnected) {
      setBars(Array(barsCount).fill(6));
      return;
    }
    if (volume > threshold) {
      // lively variation scaled by volume
      setBars(prev =>
        prev.map(() => {
          const jitter = Math.random() * 0.9 + 0.1;
          const h = Math.min(90, Math.max(6, volume * 1200 * jitter));
          return h;
        })
      );
    } else {
      // quiet -> low bars, small random ripple
      setBars(prev =>
        prev.map(() => 6 + Math.random() * 4)
      );
    }
  }, [volume, isConnected, barsCount]);

  const pulse = isConnected && volume <= threshold
    ? {
        scale: [1, 1.08, 1],
        opacity: [1, 0.9, 1],
        transition: { duration: 0.9, repeat: Infinity },
      }
    : {};

  const btnBase =
    "inline-flex items-center justify-center rounded-full text-white w-10 h-10 shadow-lg focus:outline-none focus:ring-1 focus:ring-neutral-500";
  const btnGreen = `${btnBase} bg-green-600 hover:bg-green-500`;
  const btnRed = `${btnBase} bg-red-600 hover:bg-red-500`;

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
                // spread bars from center (x=500) outward
                const step = 1000 / bars.length; // width/num
                const cw = 6;                     // column width
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
                      isConnected
                        ? "text-white/80"
                        : "text-neutral-500/40"
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
            onClick={onStart}
            className={btnGreen}
            aria-label="Start call"
            title="Start Call"
          >
            <Phone size={18} />
          </button>
        )}
      </motion.div>
    </div>
  );
}
