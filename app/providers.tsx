// app/providers.tsx
"use client";

import React from "react";
import { TenantProvider } from "@/context/tenant-context";
import { TranslationsProvider } from "@/context/translations-context";

type Props = {
  children: React.ReactNode;
};

export default function Providers({ children }: Props) {
  return (
    <TenantProvider>
      <TranslationsProvider>{children}</TranslationsProvider>
    </TenantProvider>
  );
}
