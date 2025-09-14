// app/providers.tsx
"use client";

import React from "react";
import { RealtimeProvider } from "@/context/realtime-context";
import { TenantProvider } from "@/context/tenant-context";
import { TranslationsProvider } from "@/context/translations-context";
import { ToolRegistryProvider } from "@/context/registry-context";

type Props = {
  children: React.ReactNode;
};

export default function Providers({ children }: Props) {
  return (
      <RealtimeProvider
          options={{
            model: 'gpt-realtime',
            defaultVoice: 'alloy',
            appendModelVoiceToUrl: true,
            // turnDetection: { type: 'server_vad', threshold: 0.5, ... } // optional
          }}
        >   
      <TenantProvider>
        <ToolRegistryProvider >
          <TranslationsProvider>
            {children}
          </TranslationsProvider>
        </ToolRegistryProvider >
      </TenantProvider>
    </RealtimeProvider>
  );
}
