"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/**
 * Visual Registry
 * ---------------
 * A simple name -> React component map used by VisualStage to render rich UI
 * panels. Components receive whatever was provided in `payload.props` from the
 * ShowArgs / descriptor UI template (e.g., props.intentId, props.quote, etc.).
 */

// ---- Public API -----------------------------------------------------------

const registry: Record<string, React.ComponentType<any>> = {
  payment_form: PaymentForm,
  quote_summary: QuoteSummary,
  catalog_results: CatalogResults,
  reservation_confirmation: ReservationConfirmation,
  room: RoomGallery, // generic gallery that can derive images from tenant/unit
  waterfall_video: VideoPlayer, // kept for parity with your prior baseRegistry
  image_viewer: ImageViewer,
};

export function getVisualComponent(name: string) {
  return registry[name];
}

export function registerVisualComponent(name: string, comp: React.ComponentType<any>) {
  registry[name] = comp;
}

// ---- Types shared by components ------------------------------------------

type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string; // ISO-2
};

// ---- Payment Form ---------------------------------------------------------

type PaymentFormProps = {
  intentId?: string;
  reservationId?: string;
  amountCents?: number | string;
  currency?: string; // e.g., "USD"
  prefill?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: Address;
  };
  onSubmit?: (data: any) => void;
};

function PaymentForm({ intentId, reservationId, amountCents, currency, prefill, onSubmit }: PaymentFormProps) {
  const [loading, setLoading] = React.useState(false);

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">Complete your payment</CardTitle>
        <CardDescription className="text-xs text-neutral-400">
          Supports Visa, Mastercard, Amex, and debit cards. Your details are encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            const data = Object.fromEntries(fd.entries());
            try {
              onSubmit?.({
                ...data,
                intentId,
                reservationId,
                amountCents,
                currency,
              });
              // TODO: integrate your PSP card element + confirm logic here
              await new Promise((r) => setTimeout(r, 600));
            } finally {
              setLoading(false);
            }
          }}
        >
          {/* Amount summary (read-only) */}
          {(amountCents || currency) && (
            <div className="mb-2 text-sm text-neutral-300">
              Amount: <span className="font-medium">{formatMoney(amountCents, currency)}</span>
              {reservationId ? (
                <span className="ml-2 text-neutral-500">(Reservation {reservationId})</span>
              ) : null}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="name">Name on card</Label>
            <Input id="name" name="name" defaultValue={prefill?.name} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={prefill?.email} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={prefill?.phone} />
          </div>

          <Separator className="my-2 bg-neutral-800" />

          <div className="grid gap-2">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" name="line1" defaultValue={prefill?.address?.line1} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="line2">Address line 2</Label>
            <Input id="line2" name="line2" defaultValue={prefill?.address?.line2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={prefill?.address?.city} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="region">State / Region</Label>
              <Input id="region" name="region" defaultValue={prefill?.address?.region} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="postal">Postal</Label>
              <Input id="postal" name="postal" defaultValue={prefill?.address?.postal} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country (ISO-2)</Label>
              <Input id="country" name="country" defaultValue={prefill?.address?.country} />
            </div>
          </div>

          <Separator className="my-2 bg-neutral-800" />

          {/* PSP placeholder element */}
          <div className="grid gap-2">
            <Label>Card details</Label>
            <div className="bg-neutral-800 border border-neutral-700 rounded px-2 py-3 text-sm text-neutral-400">
              [ PSP card element here ]
            </div>
          </div>

          <Button type="submit" disabled={loading} className="mt-3 w-full">
            {loading ? "Processing…" : "Pay now"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- Quote Summary --------------------------------------------------------

type Quote = {
  unit?: string;
  check_in?: string;
  check_out?: string;
  nightly_rate?: string | number;
  nights?: string | number;
  total?: string | number;
  currency?: string;
  policy?: string;
};

function QuoteSummary({ quote }: { quote?: Quote }) {
  const items: { label: string; value?: React.ReactNode }[] = [
    { label: "Unit", value: quote?.unit },
    { label: "Check-in", value: quote?.check_in },
    { label: "Check-out", value: quote?.check_out },
    { label: "Nightly", value: formatMoney(quote?.nightly_rate, quote?.currency) },
    { label: "Nights", value: quote?.nights },
    { label: "Total", value: formatMoney(quote?.total, quote?.currency) },
  ];

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">Quote</CardTitle>
        {quote?.policy ? (
          <CardDescription className="whitespace-pre-wrap text-xs text-neutral-400">
            {quote.policy}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          {items.map((it) => (
            <div key={it.label} className="flex items-center justify-between border-b border-neutral-800 py-2">
              <span className="text-neutral-400">{it.label}</span>
              <span className="font-medium text-neutral-200">{it.value ?? "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Catalog Results ------------------------------------------------------

function CatalogResults({ items }: { items?: any[] }) {
  const count = Array.isArray(items) ? items.length : 0;
  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">Catalog Results</CardTitle>
        <CardDescription className="text-xs text-neutral-400">
          Found {count} item{count === 1 ? "" : "s"}. Ask to filter or show details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px] pr-3">
          <div className="grid gap-3">
            {count === 0 ? (
              <div className="text-sm text-neutral-400">No items to display.</div>
            ) : (
              items!.map((it: any, i: number) => (
                <Card key={i} className="bg-neutral-950 border-neutral-800">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-neutral-100">{it.title || it.name || it.id || `Item ${i+1}`}</div>
                        {it.type ? <div className="text-xs text-neutral-400 mt-0.5">{it.type}</div> : null}
                        {it.description ? (
                          <div className="text-xs text-neutral-400 mt-1 line-clamp-2">{it.description}</div>
                        ) : null}
                      </div>
                      {it.tags && Array.isArray(it.tags) ? (
                        <div className="flex flex-wrap gap-1">
                          {it.tags.map((t: string) => (
                            <Badge key={t} variant="secondary" className="bg-neutral-800 text-neutral-300">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ---- Reservation Confirmation --------------------------------------------

function ReservationConfirmation({ reservation_id, unit_id, check_in, check_out }: {
  reservation_id?: string;
  unit_id?: string;
  check_in?: string;
  check_out?: string;
}) {
  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">Reservation confirmed</CardTitle>
        <CardDescription className="text-xs text-neutral-400">
          We’ve sent a confirmation email with your reservation details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between border-b border-neutral-800 py-2">
            <span className="text-neutral-400">Reservation ID</span>
            <span className="font-medium text-neutral-200">{reservation_id || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-neutral-800 py-2">
            <span className="text-neutral-400">Unit</span>
            <span className="font-medium text-neutral-200">{unit_id || "—"}</span>
          </div>
          <div className="flex items-center justify-between border-b border-neutral-800 py-2">
            <span className="text-neutral-400">Check-in</span>
            <span className="font-medium text-neutral-200">{check_in || "—"}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-400">Check-out</span>
            <span className="font-medium text-neutral-200">{check_out || "—"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Room Gallery (tenant-aware) -----------------------------------------

type RoomGalleryProps = {
  tenantId?: string; // strongly recommended for image sourcing
  unitId?: string;
  gallery?: string[]; // if provided, use directly; otherwise derive from registry
};

function RoomGallery({ tenantId = "cypress-resorts", unitId = "unit-villa-1", gallery }: RoomGalleryProps) {
  const urls = Array.isArray(gallery) && gallery.length > 0
    ? gallery
    : getTenantUnitGallery(tenantId, unitId);

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">Room gallery</CardTitle>
        <CardDescription className="text-xs text-neutral-400">
          {tenantId} · {unitId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {urls.length === 0 ? (
            <div className="col-span-3 text-sm text-neutral-400">No images registered for this unit.</div>
          ) : (
            urls.map((src, i) => (
              <ImageViewer key={i} src={src} alt={`Room image ${i + 1}`} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Image Viewer ---------------------------------------------------------

type ImageViewerProps = {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
};

function ImageViewer({ src = "/images/placeholder-room.jpg", alt = "image", width = 640, height = 420 }: ImageViewerProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="relative">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="w-full h-auto object-cover"
        />
      </div>
    </div>
  );
}

// ---- Video Player ---------------------------------------------------------

type VideoPlayerProps = {
  src?: string;
  poster?: string;
};

function VideoPlayer({ src = "/videos/placeholder.mp4", poster }: VideoPlayerProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <video controls poster={poster} className="w-full rounded-lg">
        <source src={src} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

// ---- Mock Image Registry (tenant-aware) ----------------------------------

/**
 * A simple in-memory registry for tenant/unit image sets.
 * Replace with a real data source (DB, CDN manifest, etc.).
 */
const imageRegistry: Record<string, Record<string, string[]>> = {
  "cypress-resorts": {
    "unit-villa-1": [
      "/images/cypress-resorts/unit-villa-1/1.jpg",
      "/images/cypress-resorts/unit-villa-1/2.jpg",
      "/images/cypress-resorts/unit-villa-1/3.jpg",
    ],
    "unit-villa-2": [
      "/images/cypress-resorts/unit-villa-2/1.jpg",
      "/images/cypress-resorts/unit-villa-2/2.jpg",
      "/images/cypress-resorts/unit-villa-2/3.jpg",
    ],
  },
  // Add more tenants/units as needed
};

export function getTenantUnitGallery(tenantId: string, unitId: string): string[] {
  return imageRegistry[tenantId]?.[unitId] ?? [];
}

// ---- Utilities ------------------------------------------------------------

function formatMoney(amount?: number | string, currency?: string) {
  if (amount == null || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return String(amount);
  const iso = currency || "USD";
  // amount may be in cents based on upstream; try to detect if large
  const normalized = value > 999 ? value / 100 : value;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: iso }).format(normalized);
  } catch {
    return `${normalized.toFixed(2)} ${iso}`;
  }
}
