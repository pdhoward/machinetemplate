// app/providers.tsx
"use client";

import React from "react";
import { TenantProvider } from "@/context/tenant-context";
import { TranslationsProvider } from "@/context/translations-context";
import { ToolRegistryProvider } from "@/context/registry-context";

type Props = {
  children: React.ReactNode;
};

export default function Providers({ children }: Props) {
  return (
    <TenantProvider>
      <ToolRegistryProvider >
        <TranslationsProvider>
          {children}
        </TranslationsProvider>
      </ToolRegistryProvider >
    </TenantProvider>
  );
}
