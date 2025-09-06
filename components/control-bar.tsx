"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";

type ControlsBarProps = {
  isConnected: boolean;
  isMuted: boolean;
  onMute: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onEndSession?: () => void; // kept for API compatibility (unused)
  // middle cluster slots
  voiceTrigger?: React.ReactNode;
  logsTrigger?: React.ReactNode;
  transcriptTrigger?: React.ReactNode; 
  usageTrigger?: React.ReactNode;
  selfTest?: React.ReactNode;
};

export default function ControlsBar({
  isConnected,
  isMuted,
  onMute,
  onStartCall,
  onEndCall,
  voiceTrigger,
  logsTrigger,
  transcriptTrigger,
  usageTrigger,
  selfTest,
}: ControlsBarProps) {
  const btnBase =
    "inline-flex items-center justify-center rounded-full text-white w-7 h-7 transition-colors focus:outline-none focus:ring-1 focus:ring-neutral-500";
  const btnNeutral = `${btnBase} bg-neutral-600 hover:bg-neutral-500`;
  const btnWarn = `${btnBase} bg-yellow-500 hover:bg-yellow-400`;
  const btnDanger = `${btnBase} bg-red-600 hover:bg-red-500`;
  const btnSuccess = `${btnBase} bg-green-600 hover:bg-green-500`;
  const iconSize = 14;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
       {/* Call buttons (single button depending on state) */}
        
        {/* Left: Mute / Unmute */}
        <button
          onClick={onMute}
          className={isMuted ? btnWarn : btnNeutral}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff size={iconSize} /> : <Mic size={iconSize} />}
        </button>

        {/* Middle: compact cluster */}
        <div className="flex items-center gap-1.5">
          {voiceTrigger}
          {logsTrigger}
          {transcriptTrigger}
          {usageTrigger}       
          {selfTest}
        </div>     
      </div>
    </div>
  );
}
