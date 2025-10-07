// components/tenant-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type TenantCtx = {
  tenantId: string;
  token?: string | null;
  setToken: (t: string | null) => void;
};

const TenantContext = createContext<TenantCtx | null>(null);

export function TenantProvider({
  children,
  tenantId,
  token: initialToken = null,
}: {
  children: React.ReactNode;
  tenantId?: string;
  token?: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);

  // If the server sets a cookie, we can fetch a lightweight endpoint to read + expose it on first load.
  useEffect(() => {
    (async () => {
      if (token) return; // already set
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.token) setToken(data.token);
        }
      } catch {}
    })();
  }, [token]);

  const value = useMemo(
    () => ({
      tenantId: tenantId ?? process.env.NEXT_PUBLIC_TENANT_ID ?? "cypress-resorts",
      token,
      setToken,
    }),
    [tenantId, token]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within <TenantProvider>");
  return ctx;
}
