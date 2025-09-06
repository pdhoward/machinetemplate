"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TriggerIconButton from "./TriggerIconButton";
import { FlaskConical } from "lucide-react";
import SelfTest from "@/components/self-test";
import type { ConversationItem } from "@/lib/realtime";

type Props = {
  status: string;
  isConnected: boolean;
  connect: () => Promise<void> | void;
  disconnect: () => Promise<void> | void;
  sendText: (t: string) => void;
  conversation: ConversationItem[];
  componentName: string | null;
};

export default function SelfTestDialogTrigger({
  status,
  isConnected,
  connect,
  disconnect,
  sendText,
  conversation,
  componentName,
}: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <TriggerIconButton title="Self Test">
          <FlaskConical size={14} />
        </TriggerIconButton>
      </DialogTrigger>

      <DialogContent className="bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[90vw] w-[420px]">
        <DialogHeader>
          <DialogTitle>Self Test</DialogTitle>
        </DialogHeader>

        {/* Use your existing SelfTest component inside the dialog */}
        <div className="mt-2">
          <SelfTest
            status={status}
            isConnected={isConnected}
            connect={connect}
            disconnect={disconnect}
            sendText={sendText}
            conversation={conversation}
            componentName={componentName}
            className="flex items-center gap-2"
            buttonClassName="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white w-8 h-8"
            disabledClassName="inline-flex items-center justify-center rounded-full bg-neutral-500 text-white w-8 h-8"
            statusLineClassName="ml-2 text-[11px] text-neutral-300"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
