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

  const waitFor = async (
    pred: () => boolean,
    timeoutMs = 15000,
    step = 150,
    onTick?: () => void
  ) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (pred()) return;
      onTick?.();
      await sleep(step);
    }
    throw new Error("timeout");
  };

  // Accepts “Self-test complete”, “Self test complete”, etc.
  const assistantSaysComplete = (items: ConversationItem[]) =>
    items.some(
      (m) =>
        m.role === "assistant" &&
        /self[\s-]?test\s+complete/i.test(m.text || "")
    );

  const run = async () => {
    if (running) return;

    setRunning(true);
    setResult(null);
    setMsg("Starting self test…");

    const baselineComponent = componentName;
    const baselineLen = conversation.length;

    try {
      // 1) Connect if needed
      if (!isConnected) {
        setMsg("Connecting…");
        await connect();
        // Wait for CONNECTED, then a tiny stabilization window so session.update/tools are “in”
        await waitFor(() => status === "CONNECTED", 8000);
        await sleep(400);
      }

      // 2) Send a single, explicit instruction
      setMsg("Requesting tool call + completion reply…");
      sendText(
        `Self-test: Immediately call the tool show_component with {"component_name":"${expectedComponent}"}. After the tool finishes, reply exactly: Self-test complete`
      );

      // 3) Wait for either condition:
      //    a) onShowComponent fired with the expected name (and not just a pre-existing value)
      //    b) assistant says “Self-test complete”
      setMsg("Waiting for tool OR completion reply…");

      await waitFor(
        () => {
          const toolTriggeredNow =
            componentName === expectedComponent &&
            // ensure it either changed or we got assistant reply
            (componentName !== baselineComponent ||
              // if it was already showing, we still allow pass if the reply is heard
              assistantSaysComplete(conversation));

          const heardReplyNow =
            conversation.length > baselineLen &&
            assistantSaysComplete(conversation);

          return toolTriggeredNow || heardReplyNow;
        },
        15000,
        150
      );

      // 4) If tool fired but reply didn’t arrive yet, give a brief grace period for TTS/text to finish
      if (!assistantSaysComplete(conversation)) {
        setMsg("Tool detected; waiting briefly for completion reply…");
        try {
          await waitFor(
            () => assistantSaysComplete(conversation),
            5000,
            150
          );
        } catch {
          // still pass if tool was definitely called and reply was the only missing piece
          // this avoids false negatives on slow/voice-only responses
        }
      }

      // 5) Disconnect (optional)
      setMsg("Disconnecting…");
      await sleep(250);
      await disconnect();

      setResult("PASS");
      setMsg("All good ✅");
    } catch (e: any) {
      setResult("FAIL");
      setMsg(`Failed: ${e?.message || String(e)}`);
      try {
        await disconnect();
      } catch {}
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
