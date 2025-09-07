"use client";

import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import TriggerIconButton from "./TriggerIconButton";
import { ShieldCheck } from "lucide-react";
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
  events: any[]; 
  forceToolCall?: (name: string, args: any, sayAfter?: string) => void;
  getEventsCount?: () => number;
  mockShowComponent?: (name: string) => void;
};

export default function SelfTestDialogTrigger({
  status,
  isConnected,
  connect,
  disconnect,
  sendText,
  conversation,
  componentName,
  events,
  forceToolCall,
  getEventsCount,
  mockShowComponent,
}: Props) {
  const btnClass = isConnected
    ? "bg-emerald-600 hover:bg-emerald-500"
    : "bg-red-600 opacity-60 cursor-not-allowed";
  

  return (
    <Dialog>
      <DialogTrigger asChild disabled={!isConnected}>
        <TriggerIconButton
          title={isConnected ? "Self Test" : "Connect to run self test"}
          className={btnClass + " w-7 h-7"}
          disabled={!isConnected}
        >
          <ShieldCheck size={14} />
        </TriggerIconButton>
      </DialogTrigger>

      <DialogContent className="bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[90vw] w-[460px]">
        <DialogHeader>
          <DialogTitle>Self Test</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <SelfTest
            status={status}
            isConnected={isConnected}
            connect={connect}
            disconnect={disconnect}
            sendText={sendText}
            conversation={conversation}
            componentName={componentName}           
            forceToolCall={forceToolCall}
            getEventsCount={getEventsCount}
            mockShowComponent={mockShowComponent}
            className="flex flex-col"
            buttonClassName="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white w-8 h-8"
            disabledClassName="inline-flex items-center justify-center rounded-full bg-neutral-600 text-white w-8 h-8"
            statusLineClassName="mt-2 text-[12px] text-neutral-300"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
