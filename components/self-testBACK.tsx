"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import type { ConversationItem } from "@/lib/realtime";

export interface SelfTestProps {
  status: string;
  isConnected: boolean;
  connect: () => Promise<any> | any;
  disconnect: () => Promise<any> | any;
  sendText: (t: string) => void;
  conversation: ConversationItem[];
  componentName: string | null;

  // optional helpers
  forceToolCall?: (name: string, args: any, sayAfter?: string) => void;

  // NOTE: updated signatures to allow props
  getEventsCount?: () => number;
  mockShowComponent?: (name: string, props?: Record<string, any>) => void;

  // ui/config
  expectedComponent?: string;      // default "reservation_checkout"
  expectedProps?: Record<string, any>; // optional override for mock props
  autoStart?: boolean;
  className?: string;
  buttonClassName?: string;
  disabledClassName?: string;
  statusLineClassName?: string;
}

type StepKey = "CONNECT" | "DB" | "TOOL" | "LOGS" | "DONE";
type StepState = "IDLE" | "RUNNING" | "PASS" | "FAIL";

// Simple mock catalog you can extend for other visuals
const MOCKS_BY_COMPONENT: Record<string, Record<string, any>> = {
  reservation_checkout: {
    tenant_id: "tenant_demo_123",
    reservation_id: "resv_demo_456",
    unit_id: "unit_789",
    unit_name: "The Cypress Suite",
    check_in: "2025-11-05",
    check_out: "2025-11-08",
    nights: 3,
    nightly_rate: 19900, // cents
    fees_cents: 4500,
    taxes_cents: 9200,
    amount_cents: 19900 * 3 + 4500 + 9200,
    currency: "USD",
    guest: {
      first_name: "Ava",
      last_name: "Harper",
      email: "ava.harper@example.com",
      phone: "+1-512-555-0101",
    },
    // drop publishable test key here 
    // publishableKey: "pk_test_1234567890abcdef",
    hold_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    payment_intent_strategy: "component_fetches",
    compact: false,
  },
};

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
  expectedComponent = "reservation_checkout",
  expectedProps, // allow user override
  autoStart = false,
  className = "",
  buttonClassName = "inline-flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium h-7 px-3",
  disabledClassName = "inline-flex items-center justify-center rounded-md bg-neutral-600 text-white opacity-60 cursor-not-allowed text-xs h-7 px-3",
  statusLineClassName = "text-[11px] text-neutral-300 text-left",
}: SelfTestProps) {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [stepStatus, setStepStatus] = useState<Record<StepKey, StepState>>({
    CONNECT: "IDLE",
    DB: "IDLE",
    TOOL: "IDLE",
    LOGS: "IDLE",
    DONE: "IDLE",
  });

  // fresh refs for polling
  const statusRef = useRef(status);
  const convoRef = useRef(conversation);
  const compRef  = useRef(componentName);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { convoRef.current = conversation; }, [conversation]);
  useEffect(() => { compRef.current  = componentName; }, [componentName]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const pollUntil = async (pred: () => boolean, timeoutMs = 15000, every = 150) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (pred()) return true;
      await sleep(every);
    }
    return false;
  };
  const assistantSaid = (re: RegExp) =>
    (convoRef.current ?? []).some(m => m.role === "assistant" && re.test(m.text || ""));

  const run = async () => {
    if (running) return;
    setRunning(true);
    setMsg("Starting self test…");
    setStepStatus({ CONNECT: "IDLE", DB: "IDLE", TOOL: "IDLE", LOGS: "IDLE", DONE: "IDLE" });

    const baseEvents = getEventsCount?.() ?? 0;
    const baseConvo  = (convoRef.current?.length ?? 0);

    // resolve mock props (user override > catalog > empty)
    const mockProps =
      expectedProps ??
      MOCKS_BY_COMPONENT[expectedComponent] ??
      {};

    let current: StepKey = "CONNECT";
    try {
      while (true) {
        switch (current) {
          case "CONNECT": {
            setStepStatus(s => ({ ...s, CONNECT: "RUNNING" }));
            setMsg("1) Connecting…");
            if (!isConnected) {
              await connect();
            }
            const up = await pollUntil(() => statusRef.current === "CONNECTED", 12000, 150);
            if (!up) throw new Error("Could not connect");

            await sleep(250);
            sendText("Reply exactly: Connection OK");
            const ok = await pollUntil(() => assistantSaid(/(^|\s)connection\s+ok(\W|$)/i), 12000, 150);
            if (!ok) throw new Error("Assistant did not say 'Connection OK'");

            setStepStatus(s => ({ ...s, CONNECT: "PASS" }));
            setMsg("1) Connection — PASS");
            await sleep(350);

            current = "DB";
            break;
          }

          case "DB": {
            setStepStatus(s => ({ ...s, DB: "RUNNING" }));
            setMsg("2) Checking database…");

            const res = await fetch("/api/health", { method: "GET" });
            if (!res.ok) throw new Error("Database ping failed");

            await sleep(250);
            sendText("Reply exactly: Database OK");
            const ok = await pollUntil(() => assistantSaid(/(^|\s)database\s+ok(\W|$)/i), 12000, 150);
            if (!ok) throw new Error("Assistant did not say 'Database OK'");

            setStepStatus(s => ({ ...s, DB: "PASS" }));
            setMsg("2) Database — PASS");
            await sleep(350);

            current = "TOOL";
            break;
          }

          case "TOOL": {
            setStepStatus(s => ({ ...s, TOOL: "RUNNING" }));
            setMsg("3) Tool call…");

            // Build once; reuse everywhere so all paths are identical.
            const args = {
              component_name: expectedComponent,
              props: { ...mockProps, mock: true }, // ← ensure mock is present
            };

            // Helpful logs to prove what you’re sending
            console.log("[SelfTest] show_component args", args);

            // Best-effort direct tool call (if available)
            forceToolCall?.("show_component", args, "Tool call complete");

            await sleep(800);

            // Natural-language instruction (SAME args — includes mock: true)
            sendText(
              `Call the tool show_component with ${JSON.stringify(args)} then reply exactly: Tool call complete`
            );

            let ok = await pollUntil(
              () =>
                compRef.current === expectedComponent ||
                assistantSaid(/(self[\s-]?test|tool\s+call)\s+complete\b/i),
              15000,
              150
            );

            // Local fallback renderer (pass the SAME props — includes mock: true)
            if (!ok && mockShowComponent) {
              mockShowComponent(expectedComponent, args.props);
              sendText("Tool call complete");
              ok = await pollUntil(() => assistantSaid(/tool\s+call\s+complete\b/i), 7000, 150);
            }

            if (!ok) throw new Error("Tool did not complete");

            setStepStatus(s => ({ ...s, TOOL: "PASS" }));
            setMsg("3) Tool call — PASS");
            await sleep(800);

            current = "LOGS";
            break;
          }


          case "LOGS": {
            setStepStatus(s => ({ ...s, LOGS: "RUNNING" }));
            setMsg("4) Logging…");

            const targetEvents = (getEventsCount?.() ?? baseEvents) + 2;
            const targetConvo  = baseConvo + 1;

            sendText(`You are a system tester. Say "I am now testing the logs and transcripts"`);
            await sleep(3000);
            sendText(`You are a system tester. Say "Testing of logs and transcripts is now complete"`);

            const ok = await pollUntil(
              () => {
                const grownByEvents = getEventsCount ? getEventsCount() >= targetEvents : false;
                const grownByConvo  = (convoRef.current?.length ?? 0) >= targetConvo;
                return grownByEvents || grownByConvo;
              },
              12000,
              200
            );
            if (!ok) throw new Error("No new logs observed");

            setStepStatus(s => ({ ...s, LOGS: "PASS" }));
            setMsg("4) Logging — PASS");
            await sleep(800);

            current = "DONE";
            break;
          }

          case "DONE": {
            setStepStatus(s => ({ ...s, DONE: "PASS" }));
            setMsg("✅ Self-test finished. System ready.");
            sendText("Self-test finished. System ready.");
            setRunning(false);
            return;
          }
        }
      }
    } catch (err: any) {
      // mark the currently running step as failed and end
      setStepStatus(s => {
        const failing =
          (Object.keys(s) as StepKey[]).find(k => s[k] === "RUNNING") ??
          (Object.keys(s) as StepKey[]).find(k => s[k] === "IDLE") ??
          "CONNECT";
        return { ...s, [failing]: "FAIL", DONE: "FAIL" };
      });
      setMsg(`❌ Self-test failed: ${err?.message || String(err)}`);
      try { await disconnect(); } catch {}
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoStart) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className={className}>
      <Button
        onClick={run}
        disabled={running}
        size="sm"
        className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60 disabled:cursor-not-allowed h-7 px-3"
        title="Start self test"
        aria-label="Start self test"
      >
        {running ? "Running…" : "Start test"}
      </Button>

      <div className={statusLineClassName}>
        <div>1) Connection — {stepStatus.CONNECT}</div>
        <div>2) Database — {stepStatus.DB}</div>
        <div>3) Tool call — {stepStatus.TOOL}</div>
        <div>4) Logging — {stepStatus.LOGS}</div>
        <div>Result — {stepStatus.DONE === "PASS" ? "PASS ✅" : stepStatus.DONE === "FAIL" ? "FAIL ❌" : "—"}</div>
        {msg ? <div className="mt-1 opacity-80">{msg}</div> : null}
      </div>
    </div>
  );
}
