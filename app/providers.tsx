// app/providers.tsx
"use client";

import React, {useCallback} from "react";
import { RealtimeProvider, useRealtime } from "@/context/realtime-context";
import { TenantProvider } from "@/context/tenant-context";
import { TranslationsProvider } from "@/context/translations-context";
import { ToolRegistryProvider } from "@/context/registry-context";

type Props = {
  children: React.ReactNode;
};

// The bridge provider
function ToolRegistryBridgeProvider({ children }: { children: React.ReactNode }) {
  const { getClient } = useRealtime();

  // ✅ Adapt the client's Record<string, Function> to ToolSnapshot
  const getSnapshot = useCallback(() => {
    try {
      const raw = getClient().getFunctionRegistrySnapshot?.(); // Record<string, Function>
      if (!raw) return null;

      const out: Record<string, (...args: any[]) => any> = {};
      for (const [name, fn] of Object.entries(raw)) {
        // functions registered (args:any)=>any|Promise<any>
        out[name] = fn as unknown as (...args: any[]) => any;
      }
      return out;
    } catch {
      return null;
    }
  }, [getClient]);

  // existing window-based event as the subscription mechanism
  const subscribeUpdates = useCallback((cb: () => void) => {
    const handler = () => cb();
    window.addEventListener("tool-registry-updated", handler);
    return () => window.removeEventListener("tool-registry-updated", handler);
  }, []);

  return (
    <ToolRegistryProvider
      getSnapshot={getSnapshot}            
      subscribeUpdates={subscribeUpdates}
    >
      {children}
    </ToolRegistryProvider>
  );
}

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
           <ToolRegistryBridgeProvider>
            <TranslationsProvider>
              {children}
            </TranslationsProvider>
          </ToolRegistryBridgeProvider >
        </TenantProvider>
     </RealtimeProvider>
  );
}
