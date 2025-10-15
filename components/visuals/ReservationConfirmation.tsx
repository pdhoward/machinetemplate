"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ReservationConfirmation({
  reservation_id,
  unit_id,
  check_in,
  check_out,
  compact,
}: {
  reservation_id?: string;
  unit_id?: string;
  check_in?: string;
  check_out?: string;
  compact?: boolean;
}) {
  const Row = ({ label, value, last }: { label: string; value?: React.ReactNode; last?: boolean }) => (
    <div className={["grid gap-1 sm:grid-cols-2 sm:items-baseline py-2", last ? "" : "border-b border-neutral-800"].join(" ")}>
      <span className="text-neutral-400 text-sm sm:text-base">{label}</span>
      <span className="font-medium text-neutral-200 break-words text-sm sm:text-base">{value ?? "—"}</span>
    </div>
  );

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Reservation confirmed</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">
          We’ve sent a confirmation email with your reservation details.
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <div className="grid gap-2">
          <Row label="Reservation ID" value={reservation_id} />
          <Row label="Unit" value={unit_id} />
          <Row label="Check-in" value={check_in} />
          <Row label="Check-out" value={check_out} last />
        </div>
      </CardContent>
    </Card>
  );
}
