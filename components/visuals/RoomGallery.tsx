"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Ruler, BedDouble, Bath, Users, Wifi, MapPin, Accessibility, Tv } from "lucide-react";
import type { UnitDoc } from "@/types/units.schema";

/* ───────────────── helpers ───────────────── */

function formatCurrency(amount?: number, currency = "USD") {
  if (typeof amount !== "number") return undefined;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
}) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="text-[13px] text-neutral-400">{label}</div>
      <div className="text-sm text-neutral-100 text-right">{value}</div>
    </div>
  );
}

function Chips({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {items.map((t) => (
        <Badge key={t} variant="secondary" className="bg-neutral-800 text-neutral-200 text-[11px]">
          {t}
        </Badge>
      ))}
    </div>
  );
}

/* ───────────────── component ───────────────── */

export default function RoomGallery({
  unit,
  dates,
  onClose, // optional: allow close from inside the modal
}: {
  unit: UnitDoc;
  dates?: { check_in?: string; check_out?: string };
  onClose?: () => void;
}) {
  const price = formatCurrency(unit.rate, unit.currency || "USD");
  const sqft = unit.config?.squareFeet;
  const beds = unit.config?.beds?.map((b) => `${b.count} ${b.size}`).join(", ");
  const baths = unit.config?.bathrooms;
  const sleeps = unit.occupancy?.sleeps;
  const view = unit.config?.view || unit.amenities?.view?.[0];

  const amen = unit.amenities ?? {};
  const policies = unit.policies ?? {};

  const locCity = unit.location?.city;
  const locState = unit.location?.state;

  const titleLine = (
    <>
      {unit.name}
      {unit.unitNumber && <span className="text-neutral-400 font-normal"> · #{unit.unitNumber}</span>}
    </>
  );

  return (
    <Card className="bg-neutral-950 border-neutral-800 w-full">
      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg leading-tight truncate">{titleLine}</CardTitle>
            <CardDescription className="text-xs sm:text-sm text-neutral-400">
              {(unit.type?.[0]?.toUpperCase() + unit.type?.slice(1)) || "Villa"}
              {view ? ` · ${String(view).toLowerCase()} view` : ""}
              {locCity ? ` · ${locCity}${locState ? `, ${locState}` : ""}` : ""}
            </CardDescription>
          </div>

          {/* Removed redundant close button; use the one from DisplayComponent */}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Price + quick facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {price && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="text-[13px] text-neutral-400">Rate</div>
              <div className="mt-1 font-semibold text-neutral-100">
                {price}
                <span className="text-xs text-neutral-400"> / night</span>
              </div>
            </div>
          )}
          {typeof sqft === "number" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="flex items-center gap-2 text-[13px] text-neutral-400">
                <Ruler className="h-4 w-4" /> Size
              </div>
              <div className="mt-1 font-medium text-neutral-100">{sqft.toLocaleString()} ft²</div>
            </div>
          )}
          {beds && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="flex items-center gap-2 text-[13px] text-neutral-400">
                <BedDouble className="h-4 w-4" /> Beds
              </div>
              <div className="mt-1 font-medium text-neutral-100">{beds}</div>
            </div>
          )}
          {typeof sleeps === "number" && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="flex items-center gap-2 text-[13px] text-neutral-400">
                <Users className="h-4 w-4" /> Sleeps
              </div>
              <div className="mt-1 font-medium text-neutral-100">{sleeps}</div>
            </div>
          )}
        </div>

        {/* Description */}
        {unit.description && <p className="text-sm text-neutral-300 leading-relaxed">{unit.description}</p>}

        <Separator className="bg-neutral-800" />

        {/* Structured details (single column on mobile, two cols on sm+) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-1.5">
            <Row label="Bathrooms" value={typeof baths === "number" ? `${baths}` : undefined} />
            <Row label="Kitchen / Kitchenette" value={(amen.kitchenette ?? []).join(", ") || undefined} />
            <Row label="Bath amenities" value={(amen.bath ?? []).join(", ") || undefined} />
            <Row label="Wellness" value={(amen.wellness ?? []).join(", ") || undefined} />
            <Row label="Outdoor" value={(amen.outdoor ?? []).join(", ") || undefined} />
          </div>

          {/* Right column */}
          <div className="space-y-1.5">
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <Wifi className="h-4 w-4" /> Wi-Fi
                </span>
              }
              value={unit.tech?.wifi?.available ? "Included" : "—"}
            />
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <Tv className="h-4 w-4" /> TV / Casting
                </span>
              }
              value={
                unit.tech?.tv?.available
                  ? (["TV", unit.tech?.tv?.casting ? "Casting" : null].filter(Boolean) as string[]).join(" • ")
                  : "—"
              }
            />
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <Accessibility className="h-4 w-4" /> Accessibility
                </span>
              }
              value={(unit.amenities?.accessibility ?? []).join(", ") || (unit.config?.ada ? "ADA" : undefined)}
            />
            <Row
              label={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> Location
                </span>
              }
              value={
                locCity
                  ? `${locCity}${locState ? `, ${locState}` : ""}`
                  : unit.location?.unitPositionNotes || "—"
              }
            />
            <Row
              label="Policies"
              value={
                [
                  policies.smoking ? `Smoking: ${policies.smoking}` : null,
                  policies.pets?.allowed != null ? `Pets: ${policies.pets.allowed ? "Allowed" : "Not allowed"}` : null,
                  policies.checkInTime ? `Check-in ${policies.checkInTime}` : null,
                  policies.checkOutTime ? `Check-out ${policies.checkOutTime}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ") || undefined
              }
            />
          </div>
        </div>

        {/* Labels / tags chips (optional) */}
        {(unit.labels?.length || unit.tags?.length) ? (
          <>
            <Separator className="bg-neutral-800" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="text-[13px] text-neutral-400">Highlights</div>
              <Chips items={[...(unit.labels ?? []), ...(unit.tags ?? [])]} />
            </div>
          </>
        ) : null}

        {/* Dates (if provided) */}
        {dates && (dates.check_in || dates.check_out) && (
          <div className="text-xs text-neutral-400">
            {dates.check_in ?? "—"} → {dates.check_out ?? "—"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}