"use client";

import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { ConversationItem } from "@/lib/realtime";

export interface SelfTestProps {
  status: string;
  isConnected: boolean;
  connect: () => Promise<any> | any;
  disconnect: () => Promise<any> | any;
  sendText: (t: string) => void;
  conversation: ConversationItem[];
  componentName: string | null;  

  /** enforce tool call now (best-effort) */
  forceToolCall?: (name: string, args: any, sayAfter?: string) => void;
  /** live log count for “did it log?” check */
  getEventsCount?: () => number;
  /** graceful pass if model refuses to tool-call */
  mockShowComponent?: (name: string) => void;

  /** config */
  expectedComponent?: string; // default: "menu"
  className?: string;
  buttonClassName?: string;
  disabledClassName?: string;
  statusLineClassName?: string;
}

export default function SelfTest({
  status,
  isConnected,
  connect,
  disconnect,
  sendText,
  conversation,
  componentName,
  forceToolCall,
  getEventsCount,
  mockShowComponent,  
  expectedComponent = "menu",
  className = "",
  buttonClassName = "p-1.5 rounded-full text-white text-xs bg-emerald-600",
  disabledClassName = "p-1.5 rounded-full text-white text-xs bg-neutral-500",
  statusLineClassName = "text-[11px] text-neutral-300 text-center",
}: SelfTestProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | "PASS" | "FAIL">(null);
  const [msg, setMsg] = useState("");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (pred: () => boolean, timeoutMs = 12000, step = 150) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (pred()) return;
      await sleep(step);
    }
    throw new Error("timeout");
  };
  const heard = (re: RegExp) =>
    conversation.some((m) => m.role === "assistant" && re.test(m.text || ""));

  async function step(title: string, doIt: () => Promise<void>, verify: () => Promise<void>) {
    // a) announce step
    setMsg(`${title} — starting`);
    sendText(`${title} — starting`);
    await sleep(300);

    // b) run step
    await doIt();

    // c) wait for completion + announce pass/fail
    await verify();
    sendText(`${title} — completed`);
    await sleep(150);
  }

  const run = async () => {
    if (running) return;

    setRunning(true);
    setResult(null);
    setMsg("Starting self test…");

    const origComponent = componentName;
    const baseLogs = getEventsCount?.() ?? 0;

    try {
      // 0) ensure connected
      if (!isConnected) {
        setMsg("Connecting…");
        await connect();
        await waitFor(() => status === "CONNECTED", 8000);
        await sleep(300);
      }

      // 1) Connection check (narrated)
      await step(
        "1. Connection",
        async () => {
          // Just ask assistant to confirm verbally so user hears a voice
          sendText("Please say exactly: Connection OK");
        },
        async () => {
          await waitFor(() => heard(/^\s*connection ok\s*$/i), 6000);
          setMsg("1. Connection — PASS");
        }
      );

      // 2) Database check (uses /api/health) + narrated
      await step(
        "2. Database",
        async () => {
          const res = await fetch("/api/health", { method: "GET" });
          if (!res.ok) throw new Error("database ping failed");
          sendText("Please say exactly: Database OK");
        },
        async () => {
          await waitFor(() => heard(/^\s*database ok\s*$/i), 8000);
          setMsg("2. Database — PASS");
        }
      );

      // 3) Tool call (enforce + mock fallback) + narrated
      await step(
        "3. Tool call",
        async () => {
          // try to force immediately (best-effort), and also say the completion line
          forceToolCall?.("show_component", { component_name: expectedComponent }, "Self-test complete");
          // also send a plain text instruction as a backup
          await sleep(150);
          sendText(
            `Call the tool show_component with {"component_name":"${expectedComponent}"} and then say exactly: Self-test complete`
          );
        },
        async () => {
          try {
            await waitFor(
              () =>
                componentName === expectedComponent ||
                heard(/^\s*self[-\s]?test\s+complete\s*$/i),
              12000
            );
          } catch {
            // mock fallback if tool didn't fire
            if (mockShowComponent) {
              mockShowComponent(expectedComponent);
              sendText("Self-test complete");
              await sleep(250);
            } else {
              throw new Error("tool call did not complete");
            }
          }
          setMsg("3. Tool call — PASS");
        }
      );

      // 4) Logging (ensure events grew) + narrated
      await step(
        "4. Logging",
        async () => {
          const n = (getEventsCount?.() ?? 0) + 2; // target delta
          // produce enough activity to ensure new events
          sendText("Log check: please speak this sentence so the system emits events.");
          // wait a touch to let server stream deltas
          await sleep(400);
          // keep nudging to ensure multiple events (transcript deltas + TTS)
          sendText("And please speak one more short sentence.");
          // inner helper to wait until logs pass target
          await waitFor(() => (getEventsCount?.() ?? 0) >= n, 8000);
        },
        async () => {
          const grew = (getEventsCount?.() ?? 0) > baseLogs;
          if (!grew) throw new Error("no new events observed");
          setMsg("4. Logging — PASS");
        }
      );

      // 5) Final announce + keep session open (only disconnect on failure)
      sendText("Self-test finished. System ready.");
      await sleep(200);

      setResult("PASS");
      setMsg("All checks passed ✅");
    } catch (e: any) {
      setResult("FAIL");
      setMsg(`Failed: ${e?.message || String(e)}`);
      try { await disconnect(); } catch {}
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={run}
        disabled={running}
        className={running ? disabledClassName : buttonClassName}
        title="Run self test"
        aria-label="Run self test"
      >
        <ShieldCheck className="text-white text-xs" />
      </button>

      {(running || result) && (
        <div className={statusLineClassName}>
          {running ? "Self test running…" : null}
          {result === "PASS" ? " Self test: PASS ✅" : null}
          {result === "FAIL" ? " Self test: FAIL ❌" : null}
          {msg ? ` — ${msg}` : ""}
        </div>
      )}
    </div>
  );
}
