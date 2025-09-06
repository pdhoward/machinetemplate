"use client";

import React from "react";
import { Phone, PhoneOff, Mic, MicOff, Eye } from "lucide-react";

type ControlsBarProps = {
  isConnected: boolean;
  isMuted: boolean;
  transcriptOpen: boolean;
  onMute: () => void;
  onStartCall: () => void;
  onEndCall: () => void;
  onEndSession: () => void; // kept for API compatibility (not rendered)
  onToggleTranscription: () => void;
  // middle cluster slots
  voiceTrigger?: React.ReactNode;
  logsTrigger?: React.ReactNode;
  onDownload?: () => void;
  downloadTrigger?: React.ReactNode; // optional custom button
  selfTest?: React.ReactNode;
};

export default function ControlsBar({
  isConnected,
  isMuted,
  transcriptOpen,
  onMute,
  onStartCall,
  onEndCall,
  // onEndSession (intentionally unused)
  onToggleTranscription,
  voiceTrigger,
  logsTrigger,
  onDownload,
  downloadTrigger,
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
         {/* Call buttons (simplified) */}
        {isConnected ? (
          <button
            onClick={onEndCall}
            className={btnDanger}
            title="End Call"
          >
            <PhoneOff size={iconSize} />
          </button>
        ) : (
          <button
            onClick={onStartCall}
            className={btnSuccess}
            title="Start Call"
          >
            <Phone size={iconSize} />
          </button>
        )}
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
          {/* Voice dialog trigger */}
          {voiceTrigger}

          {/* Logs dialog trigger */}
          {logsTrigger}

          {/* Download */}
          {downloadTrigger ? (
            downloadTrigger
          ) : (
            <button
              onClick={onDownload}
              className={btnNeutral}
              title="Download Transcription"
            >
              ⤓
            </button>
          )}

          {/* SelfTest */}
          {selfTest}
        </div>

       
      </div>

      {/* Toggle transcription */}
      <button
        onClick={onToggleTranscription}
        className="w-full flex items-center justify-center gap-1 text-neutral-200 bg-neutral-700 hover:bg-neutral-600 rounded-lg py-1.5 text-xs"
        title="Toggle transcription view"
      >
        <Eye size={12} />
        {transcriptOpen ? "Hide transcript" : "Show transcript"}
      </button>
    </div>
  );
}
