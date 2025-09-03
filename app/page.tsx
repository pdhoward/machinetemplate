"use client"

import React, { useEffect, useState, useRef } from "react"
import useWebRTCAudioSession from "@/hooks/use-webrtc"
import { tools } from "@/lib/tools"
import { Welcome } from "@/components/welcome"
import { VoiceSelector } from "@/components/voice-select"
import { BroadcastButton } from "@/components/broadcast-button"
import { StatusDisplay } from "@/components/status"
import { TokenUsageDisplay } from "@/components/token-usage"
import { MessageControls } from "@/components/message-controls"
import { ToolsEducation } from "@/components/tools-education"
import { TextInput } from "@/components/text-input"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Eye,
  UserPlus,
  FileOutput,
  Download,
} from 'lucide-react';
import { motion } from "framer-motion"
import { useToolsFunctions } from "@/hooks/use-tools"

import { SessionStatus, Message } from '@/types';

const App: React.FC = () => {
 
  const [voice, setVoice] = useState("ash")

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('DISCONNECTED');
  const [timer, setTimer] = useState<number>(0);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebRTC Audio Session Hook
  const {
    status,
    isSessionActive,
    registerFunction,
    handleStartStopClick,
    msgs,
    conversation,
    sendTextMessage
  } = useWebRTCAudioSession(voice, tools)

  // Get all tools functions
  const toolsFunctions = useToolsFunctions();

  useEffect(() => {
    // Register all functions by iterating over the object
    Object.entries(toolsFunctions).forEach(([name, func]) => {
      const functionNames: Record<string, string> = {
        timeFunction: 'getCurrentTime',
        backgroundFunction: 'changeBackgroundColor',
        partyFunction: 'partyMode',
        launchWebsite: 'launchWebsite', 
        copyToClipboard: 'copyToClipboard',
        scrapeWebsite: 'scrapeWebsite'
      };
      
      registerFunction(functionNames[name], func);
    });
  }, [registerFunction, toolsFunctions])

  useEffect(() => {

    console.log(`status is now ${status}`)

     //else if (status.startsWith("Session established")) {

  }, [status])

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (sessionStatus === 'CONNECTED') {
      interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
      setTimer(0);
    };
  }, [sessionStatus]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
     <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header className="bg-gradient-to-r from-neutral-800 to-neutral-700 p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-neutral-200">Cypress Resorts</h1>
        </div>
        <span className="text-sm text-neutral-400">Luxury Awaits</span>
      </header>
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4">
        
        <div className="md:w-1/3 flex justify-center items-center">
           <motion.div
      className="relative flex items-center justify-center w-full h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative w-[240px] h-[480px] bg-neutral-900 rounded-[32px] border-2 border-neutral-800 shadow-xl overflow-hidden">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-neutral-800 rounded-b-lg z-10" />
        <div className="absolute top-6 bottom-0 left-0 right-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-3">
            
           <div className="h-full flex flex-col text-neutral-200">
              <div className="flex justify-between items-center mb-2 px-3">
                <h3 className="text-sm font-semibold">{'Cypress Resorts '}</h3>
                <span className="text-xs">{formatTime(timer)}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 no-scrollbar max-w-full box-sizing-border-box">
               <motion.div 
                  className="w-full max-w-md bg-card text-card-foreground rounded-xl border shadow-sm p-6 space-y-4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <VoiceSelector value={voice} onValueChange={setVoice} />
                  
                  
                  {msgs.length > 4 && <TokenUsageDisplay messages={msgs} />}
                  {status && (
                    <motion.div 
                      className="w-full flex flex-col gap-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <MessageControls conversation={conversation} msgs={msgs} />
                      <TextInput 
                        onSubmit={sendTextMessage}
                        disabled={!isSessionActive}
                      />
                    </motion.div>
                  )}
                </motion.div>
                <div ref={messagesEndRef} />
              </div>
             
              {isSessionActive && (
                <div className="text-xs text-neutral-400 text-center p-2">
                  Status: {isSessionActive ? `Open` : 'Closed'}
                </div>
              )}
            </div>

          </div>
          <div className="p-3 space-y-2 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              {isCallActive ? (
                <>
                  <button
                    onClick={onMute}
                    className={`p-1.5 rounded-full ${isMuted ? 'bg-yellow-500' : 'bg-neutral-600'}`}
                  >
                    {isMuted ? (
                      <MicOff className="text-white text-xs" />
                    ) : (
                      <Mic className="text-white text-xs" />
                    )}
                  </button>
                  <div className="flex items-center gap-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="p-1.5 rounded-full bg-neutral-600 text-white text-xs">
                          <UserPlus />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="bg-neutral-900 text-neutral-200 border-neutral-800">
                        <DialogHeader>
                          <DialogTitle>Select Voice</DialogTitle>
                        </DialogHeader>
                        <div className="text-sm text-neutral-400">Coming soon</div>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="p-1.5 rounded-full bg-neutral-600 text-white text-xs">
                          <FileOutput />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="bg-neutral-900 text-neutral-200 border-neutral-800 max-w-[90vw] max-h-[80vh] w-[400px] h-[400px] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>System Logs</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          <input
                            type="text"
                            value={logSearchQuery}
                            onChange={(e) => setLogSearchQuery(e.target.value)}
                            placeholder="Search logs..."
                            className="w-full p-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-lg border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-gold-500"
                          />
                        </div>
                        <div className="flex-1 overflow-y-auto text-xs text-neutral-400">
                          {filteredLogs.length > 0 ? (
                            filteredLogs.map((log, index) => (
                              <p key={index} className="border-b border-neutral-700 py-1">
                                {log.data?.text ?? 'No log content'}
                              </p>
                            ))
                          ) : (
                            <p>No logs available.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <button
                      onClick={downloadTranscription}
                      className="p-1.5 rounded-full bg-neutral-600 text-white text-xs"
                      title="Download Transcription"
                    >
                      <Download />
                    </button>
                  </div>
                  <button
                    onClick={onEndCall}
                    className="p-1.5 rounded-full bg-red-600"
                  >
                    <PhoneOff className="text-white text-xs" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onStartCall}
                    className="p-1.5 rounded-full bg-green-600"
                  >
                    <Phone className="text-white text-xs" />
                  </button>
                  <button
                    onClick={onEndSession}
                    className="p-1.5 rounded-full bg-neutral-600"
                    title="End Session"
                  >
                    <PhoneOff className="text-white text-xs" />
                  </button>
                </>
              )}
            </div>
            <button
              onClick={onToggleTranscription}
              className="p-1.5 bg-neutral-700 rounded-lg text-neutral-200 w-full flex justify-center"
            >
              <Eye className="text-xs" />
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-neutral-400 text-sm"
        >
          ×
        </button>
      </div>
    </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

export default App;