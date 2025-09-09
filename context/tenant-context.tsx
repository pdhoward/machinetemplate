// components/tenant-context.tsx
"use client";

import React, { createContext, useContext } from "react";

type TenantCtx = { tenantId: string; token?: string | null };
const TenantContext = createContext<TenantCtx | null>(null);

export function TenantProvider({
  children,
  tenantId,
  token = null,
}: {
  children: React.ReactNode;
  tenantId?: string;
  token?: string | null;
}) {
  const value: TenantCtx = {
    tenantId: tenantId ?? process.env.NEXT_PUBLIC_TENANT_ID ?? "cypress-resorts",
    token,
  };
  return (
  <TenantContext.Provider value={value}>
    {children}
  </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within <TenantProvider>");
  return ctx;
}
