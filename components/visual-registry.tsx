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
 * Responsive & mobile-first versions.
 */

// ---- Public API -----------------------------------------------------------

const registry: Record<string, React.ComponentType<any>> = {
  payment_form: PaymentForm,
  quote_summary: QuoteSummary,
  catalog_results: CatalogResults,
  reservation_confirmation: ReservationConfirmation,
  room: RoomGallery,
  video: VideoPlayer,
  image_viewer: ImageViewer,
  media_gallery: MediaGallery,
};

export function getVisualComponent(name: string) {
  return registry[name];
}

export function registerVisualComponent(name: string, comp: React.ComponentType<any>) {
  registry[name] = comp;
}

// ---- Utilities ------------------------------------------------------------

function formatMoney(amount?: number | string, currency?: string) {
  if (amount == null || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return String(amount);
  const iso = currency || "USD";
  const normalized = value > 999 ? value / 100 : value;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: iso }).format(normalized);
  } catch {
    return `${normalized.toFixed(2)} ${iso}`;
  }
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
  compact?: boolean;
};

function PaymentForm({
  intentId,
  reservationId,
  amountCents,
  currency,
  prefill,
  onSubmit,
  compact,
}: PaymentFormProps) {
  const [loading, setLoading] = React.useState(false);

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[720px]">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Complete your payment</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">
          Supports Visa, Mastercard, Amex, and debit cards. Your details are encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            const data = Object.fromEntries(fd.entries());
            try {
              onSubmit?.({ ...data, intentId, reservationId, amountCents, currency });
              await new Promise((r) => setTimeout(r, 600));
            } finally {
              setLoading(false);
            }
          }}
        >
          {(amountCents || currency) && (
            <div className="mb-2 text-sm sm:text-base text-neutral-300">
              Amount: <span className="font-medium">{formatMoney(amountCents, currency)}</span>
              {reservationId ? <span className="ml-2 text-neutral-500">(Reservation {reservationId})</span> : null}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="name" className="text-xs sm:text-sm">Name on card</Label>
            <Input id="name" name="name" defaultValue={prefill?.name} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={prefill?.email} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone" className="text-xs sm:text-sm">Phone</Label>
            <Input id="phone" name="phone" defaultValue={prefill?.phone} />
          </div>

          <Separator className="my-2 bg-neutral-800" />

          <div className="grid gap-2">
            <Label htmlFor="line1" className="text-xs sm:text-sm">Address line 1</Label>
            <Input id="line1" name="line1" defaultValue={prefill?.address?.line1} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="line2" className="text-xs sm:text-sm">Address line 2</Label>
            <Input id="line2" name="line2" defaultValue={prefill?.address?.line2} />
          </div>

          {/* stack on mobile, split on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="city" className="text-xs sm:text-sm">City</Label>
              <Input id="city" name="city" defaultValue={prefill?.address?.city} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="region" className="text-xs sm:text-sm">State / Region</Label>
              <Input id="region" name="region" defaultValue={prefill?.address?.region} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="postal" className="text-xs sm:text-sm">Postal</Label>
              <Input id="postal" name="postal" defaultValue={prefill?.address?.postal} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country" className="text-xs sm:text-sm">Country (ISO-2)</Label>
              <Input id="country" name="country" defaultValue={prefill?.address?.country} />
            </div>
          </div>

          <Separator className="my-2 bg-neutral-800" />

          <div className="grid gap-2">
            <Label className="text-xs sm:text-sm">Card details</Label>
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
function QuoteSummary({ quote, compact }: { quote?: Quote; compact?: boolean }) {
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
            <div
              key={it.label}
              className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 border-b border-neutral-800 py-2"
            >
              <span className="text-neutral-400">{it.label}</span>
              <span className="font-medium text-neutral-200 break-words">{it.value ?? "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Catalog Results ------------------------------------------------------

function CatalogResults({ items, compact }: { items?: any[]; compact?: boolean }) {
  const count = Array.isArray(items) ? items.length : 0;
  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Catalog Results</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">
          Found {count} item{count === 1 ? "" : "s"}. Ask to filter or show details.
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        {/* mobile: use viewport-based cap; desktop: fixed cap ok */}
        <ScrollArea className="max-h-[65dvh] sm:max-h-[360px] pr-2">
          <div className="grid gap-3">
            {count === 0 ? (
              <div className="text-sm text-neutral-400">No items to display.</div>
            ) : (
              items!.map((it: any, i: number) => (
                <Card key={i} className="bg-neutral-950 border-neutral-800">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-medium text-neutral-100 truncate">
                          {it.title || it.name || it.id || `Item ${i + 1}`}
                        </div>
                        {it.type ? <div className="text-xs sm:text-sm text-neutral-400 mt-0.5">{it.type}</div> : null}
                        {it.description ? (
                          <div className="text-xs sm:text-sm text-neutral-400 mt-1 line-clamp-2">
                            {it.description}
                          </div>
                        ) : null}
                      </div>
                      {it.tags && Array.isArray(it.tags) ? (
                        <div className="flex flex-wrap gap-1 shrink-0 max-w-[50%] sm:max-w-none">
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

function ReservationConfirmation({
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
  const Row = ({
    label,
    value,
    last,
  }: {
    label: string;
    value?: React.ReactNode;
    last?: boolean;
  }) => (
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

// ---- Room Gallery (tenant-aware) -----------------------------------------

type VisualMedia =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number; blurDataURL?: string }
  | { kind: "video"; src: string; poster?: string };

type RoomGalleryProps = {
  tenantId?: string;
  unitId?: string;
  media?: VisualMedia[]; // preferred: mixed images/videos
  gallery?: string[]; // legacy: array of image URLs
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

function RoomGallery({
  tenantId,
  unitId,
  media,
  gallery,
  title = "Room gallery",
  subtitle,
  compact,
}: RoomGalleryProps) {
  const items: VisualMedia[] =
    Array.isArray(media) && media.length
      ? media
      : Array.isArray(gallery)
      ? gallery.map((src) => ({ kind: "image" as const, src }))
      : [];

  const sub = subtitle ?? (tenantId && unitId ? `${tenantId} · ${unitId}` : undefined);

  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        {sub ? <CardDescription className="text-xs sm:text-sm text-neutral-400">{sub}</CardDescription> : null}
      </CardHeader>

      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        {items.length === 0 ? (
          <div className="text-sm text-neutral-400">No media available.</div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {items.map((m, i) =>
              m.kind === "image" ? (
                <div key={`img-${i}`} className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={m.src}
                      alt={m.alt ?? `image ${i + 1}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1120px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div key={`vid-${i}`} className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                  <div className="relative aspect-[4/3] w-full">
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      poster={m.poster}
                      className="w-full h-full object-cover rounded"
                      src={m.src}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        )}
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
  compact?: boolean;
};

function ImageViewer({
  src = "/images/placeholder-room.jpg",
  alt = "image",
  width = 640,
  height = 420,
  compact,
}: ImageViewerProps) {
  // Use responsive container + explicit sizes to avoid layout shift and overflow on mobile
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="relative">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 640px) 100vw, 640px"
          className="w-full h-auto object-cover"
          priority={compact}
        />
      </div>
    </div>
  );
}

// ====== VideoPlayer  ===================

type VideoPlayerProps = { src?: string; poster?: string; compact?: boolean };
function VideoPlayer({ src = "/videos/placeholder.mp4", poster, compact }: VideoPlayerProps) {
  return (
    <div className="relative w-full mx-auto sm:max-w-[800px]">
      <div
        className={[
          "w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950",
          compact ? "aspect-[16/10] max-h-[60dvh]" : "aspect-[4/3] max-h-[70dvh] sm:max-h-[600px]",
        ].join(" ")}
      >
        <video
          controls
          preload="metadata"
          playsInline
          muted
          autoPlay
          poster={poster}
          className="w-full h-full object-contain"
          src={src}
        />
      </div>
    </div>
  );
}

// ====== MediaGallery (carousel) ======================================

type VisualMediaMG =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number }
  | { kind: "video"; src: string; poster?: string };

type MediaGalleryProps = {
  media?: VisualMediaMG[]; // provided via VisualStage props
  startIndex?: number;
  title?: string;
  compact?: boolean;
};

function MediaGallery({ media = [], startIndex = 0, title, compact = false }: MediaGalleryProps) {
  const [idx, setIdx] = React.useState(Math.min(Math.max(0, startIndex), Math.max(0, media.length - 1)));
  const cur = media[idx];
  const items = Array.isArray(media) ? media : [];

  if (process.env.NODE_ENV !== "production") {
    console.debug("[MediaGallery] received media:", media, "count:", items.length);
    if (items[0]) console.debug("[MediaGallery] first item:", items[0]);
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(media.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media.length]);

  if (media.length === 0) return <div className="text-sm text-neutral-400">No media available.</div>;

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">{title || "Media Gallery"}</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">{idx + 1} / {media.length}</CardDescription>
      </CardHeader>

      <CardContent className={compact ? "pt-0 px-4 pb-3" : undefined}>
        <div className="w-full mx-auto" style={{ maxWidth: compact ? 880 : 800 }}>
          <div className="relative w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className={compact ? "aspect-[16/10] max-h-[60dvh] sm:max-h-[520px] w-full" : "aspect-[4/3] max-h-[70dvh] sm:max-h-[600px] w-full"}>
              {cur?.kind === "image" ? (
                <Image
                  src={cur.src}
                  alt={("alt" in cur && cur.alt) || "image"}
                  fill
                  sizes="(max-width: 1120px) 100vw, 1120px"
                  className="object-contain"
                />
              ) : (
                <video
                  key={cur.src}
                  controls
                  preload="metadata"
                  playsInline
                  muted
                  autoPlay
                  poster={("poster" in cur && cur.poster) || undefined}
                  className="w-full h-full object-contain"
                  src={cur.src}
                />
              )}
            </div>

            {/* Prev/Next */}
            <div className="absolute inset-y-0 left-0 flex items-center">
              <button
                className="m-2 rounded bg-black/50 hover:bg-black/70 text-white text-sm px-2 py-1"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                aria-label="Previous"
              >
                ←
              </button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button
                className="m-2 rounded bg-black/50 hover:bg-black/70 text-white text-sm px-2 py-1"
                onClick={() => setIdx((i) => Math.min(media.length - 1, i + 1))}
                aria-label="Next"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnails */}
        <div className="mt-3">
          <ScrollArea className="w-full">
            <div className="flex gap-2">
              {media.map((m, i) => {
                const isActive = i === idx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    title={`Go to media ${i + 1}`}
                    className={[
                      "relative overflow-hidden rounded border",
                      isActive ? "border-emerald-500 ring-1 ring-emerald-500" : "border-neutral-800",
                      compact ? "w-[72px] h-[54px]" : "w-[96px] h-[72px]",
                      "bg-neutral-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                    ].join(" ")}
                    aria-label={`Go to media ${i + 1}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {m.kind === "image" ? (
                      <Image
                        src={m.src}
                        alt={("alt" in m && m.alt) || `thumb ${i + 1}`}
                        fill
                        sizes={compact ? "72px" : "96px"}
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid place-items-center w-full h-full text-[10px] text-neutral-300">
                        Video
                        <span className="sr-only">Video thumbnail</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
