"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function formatMoney(amount?: number | string, currency?: string) {
  if (amount == null || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  const iso = currency || "USD";
  const normalized = value > 999 ? value / 100 : value;
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: iso }).format(normalized); }
  catch { return `${normalized.toFixed(2)} ${iso}`; }
}

export type Quote = {
  unit?: string;
  check_in?: string;
  check_out?: string;
  nightly_rate?: string | number;
  nights?: string | number;
  total?: string | number;
  currency?: string;
  policy?: string;
};

export default function QuoteSummary({ quote, compact }: { quote?: Quote; compact?: boolean }) {
  const items: { label: string; value?: React.ReactNode }[] = [
    { label: "Unit", value: quote?.unit },
    { label: "Check-in", value: quote?.check_in },
    { label: "Check-out", value: quote?.check_out },
    { label: "Nightly", value: formatMoney(quote?.nightly_rate, quote?.currency) },
    { label: "Nights", value: quote?.nights },
    { label: "Total", value: formatMoney(quote?.total, quote?.currency) },
  ];

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Quote</CardTitle>
        {quote?.policy ? (
          <CardDescription className="whitespace-pre-wrap text-xs sm:text-sm text-neutral-400">
            {quote.policy}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <div className="grid gap-2 text-sm sm:text-base">
          {items.map((it) => (
            <div key={it.label} className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 border-b border-neutral-800 py-2">
              <span className="text-neutral-400">{it.label}</span>
              <span className="font-medium text-neutral-200 break-words">{it.value ?? "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
