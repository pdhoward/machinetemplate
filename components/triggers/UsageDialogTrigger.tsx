"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TriggerIconButton from "./TriggerIconButton";
import { Braces } from "lucide-react";
import { TokenUsageDisplay } from "@/components/token-usage";

type Props = { events: any[] };

export default function UsageDialogTrigger({ events }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <TriggerIconButton title="Session Usage">
          <Braces size={14} />
        </TriggerIconButton>
      </DialogTrigger>
      <DialogContent className="bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[90vw] w-[420px]">
        <DialogHeader>
          <DialogTitle>Session Usage</DialogTitle>
        </DialogHeader>
        <div className="mt-2 text-xs text-neutral-400">
          <TokenUsageDisplay messages={events} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
