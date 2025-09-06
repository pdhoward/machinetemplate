"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TriggerIconButton from "./TriggerIconButton";
import { UserPlus } from "lucide-react";
import { VoiceSelector } from "@/components/voice-select";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function VoiceDialogTrigger({ value, onChange }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <TriggerIconButton title="Select Voice">
          <UserPlus size={14} />
        </TriggerIconButton>
      </DialogTrigger>
      <DialogContent className="bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[90vw] w-[360px]">
        <DialogHeader>
          <DialogTitle>Select Voice</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <VoiceSelector value={value} onValueChange={onChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
