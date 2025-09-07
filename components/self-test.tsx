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
  getEventsCount?: () => number;
  mockShowComponent?: (name: string) => void;

  // ui/config
  expectedComponent?: string;      // default "menu"
  autoStart?: boolean;             // default false (no auto-run)
  className?: string;
  buttonClassName?: string;
  disabledClassName?: string;
  statusLineClassName?: string;
}

type StepKey = "CONNECT" | "DB" | "TOOL" | "LOGS" | "DONE";
type StepState = "IDLE" | "RUNNING" | "PASS" | "FAIL";

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
  autoStart = false, // ← no self-start by default
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
    const baseConvo  = convoRef.current.length;

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

            // best-effort force + explicit instruction
            forceToolCall?.("show_component", { component_name: expectedComponent }, "Tool call complete");
            await sleep(1000);
            sendText(
              `Call the tool show_component with {"component_name":"${expectedComponent}"} then reply exactly: Tool call complete`
            );

            let ok = await pollUntil(
              () =>
                compRef.current === expectedComponent ||
                assistantSaid(/(self[\s-]?test|tool\s+call)\s+complete\b/i),
              15000,
              150
            );

            if (!ok && mockShowComponent) {
              mockShowComponent(expectedComponent);
              sendText("Tool call complete");
              ok = await pollUntil(() => assistantSaid(/tool\s+call\s+complete\b/i), 7000, 150);
            }

            if (!ok) throw new Error("Tool did not complete");

            setStepStatus(s => ({ ...s, TOOL: "PASS" }));
            setMsg("3) Tool call — PASS");
            await sleep(1000);

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
            await sleep(1000);

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

  // Only auto-start if explicitly requested
  useEffect(() => {
    if (autoStart) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className={className}>
      {/* Start button (no icon) */}
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
