"use client";

import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

type Msg = { role: "user" | "assistant" | "system"; text: string };

export interface SelfTestProps {
  status: string;
  isConnected: boolean;
  connect: () => Promise<any> | any;
  disconnect: () => Promise<any> | any;
  sendText: (t: string) => void;
  conversation: Msg[];
  componentName: string | null;
  /** the component your tool should show during the test */
  expectedComponent?: string; // default: "menu"
  /** optional classes to match your button style */
  className?: string;               // wrapper
  buttonClassName?: string;         // button
  disabledClassName?: string;       // when running
  statusLineClassName?: string;     // status text
}

export default function SelfTest({
  status,
  isConnected,
  connect,
  disconnect,
  sendText,
  conversation,
  componentName,
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

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setMsg("Starting self test…");

    try {
      if (!isConnected) {
        setMsg("Connecting…");
        await connect();
        await waitFor(() => status === "CONNECTED", 8000);
      }

      setMsg("Sending hello…");
      sendText("Self-test: please acknowledge with 'ready'.");
      await sleep(800);

      setMsg("Requesting tool call…");
      sendText(
        `For a quick self-test: call the tool \`show_component\` with {"component_name":"${expectedComponent}"}, then say 'Self-test complete'.`
      );

      setMsg("Waiting for tool call…");
      await waitFor(() => componentName === expectedComponent, 10000);

      setMsg("Waiting for completion reply…");
      await waitFor(
        () =>
          conversation.some(
            (m) =>
              m.role === "assistant" &&
              /self[-\s]?test complete/i.test(m.text || "")
          ),
        10000
      );

      setMsg("Disconnecting…");
      await sleep(400);
      await disconnect();

      setResult("PASS");
      setMsg("All good ✅");
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
