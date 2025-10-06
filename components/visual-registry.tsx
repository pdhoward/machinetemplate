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
  // amount may be in cents based on upstream; try to detect if large
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
  tenantId?: string;
  unitId?: string;
  media?: VisualMedia[];   // preferred: mixed images/videos
  gallery?: string[];      // legacy: array of image URLs
  title?: string;
  subtitle?: string;
};


function RoomGallery({
  tenantId,
  unitId,
  media,
  gallery,
  title = "Room gallery",
  subtitle,
}: RoomGalleryProps) {
  // Build a unified media list
  const items: VisualMedia[] = Array.isArray(media) && media.length
    ? media
    : Array.isArray(gallery)
      ? gallery.map((src) => ({ kind: "image" as const, src }))
      : [];

  const sub =
    subtitle ??
    (tenantId && unitId ? `${tenantId} · ${unitId}` : undefined);

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {sub ? (
          <CardDescription className="text-xs text-neutral-400">
            {sub}
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-neutral-400">
            No media available.
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {items.map((m, i) =>
              m.kind === "image" ? (
                <div
                  key={`img-${i}`}
                  className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
                >
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={m.src}
                      alt={m.alt ?? `image ${i + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1120px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div
                  key={`vid-${i}`}
                  className="relative w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
                >
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

// ====== VideoPlayer  ===================

type VideoPlayerProps = { src?: string; poster?: string };
function VideoPlayer({ src = "/videos/placeholder.mp4", poster }: VideoPlayerProps) {
  return (
    <div className="relative w-full mx-auto max-w-[800px]">
      <div className="aspect-[4/3] max-h-[600px] w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
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

// ======MediaGallery (carousel) ======================================

type VisualMedia =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number }
  | { kind: "video"; src: string; poster?: string };

type MediaGalleryProps = {
  media?: VisualMedia[];           // <- provided via VisualStage props auto-pass
  startIndex?: number;
  title?: string;
};

function MediaGallery({ media = [], startIndex = 0, title, compact = false }: MediaGalleryProps & { compact?: boolean }) {
  const [idx, setIdx] = React.useState(Math.min(Math.max(0, startIndex), Math.max(0, media.length - 1)));
  const cur = media[idx];

  const items = Array.isArray(media) ? media : [];

    // --- DEBUG ---
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

  if (media.length === 0) {
    return <div className="text-sm text-neutral-400">No media available.</div>;
  }

  return (
   <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base">{title || "Media Gallery"}</CardTitle>
        <CardDescription className="text-xs text-neutral-400">
          {idx + 1} / {media.length}
        </CardDescription>
      </CardHeader>

      <CardContent className={compact ? "pt-0 px-4 pb-3" : undefined}>
        {/* Main viewer: tighten max height when compact */}
        <div className="w-full mx-auto" style={{ maxWidth: compact ? 880 : 800 }}>
          <div className="relative w-full bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className={compact ? "aspect-[16/10] max-h-[520px] w-full" : "aspect-[4/3] max-h-[600px] w-full"}>
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

            {/* Prev/Next buttons (unchanged) */}
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

       {/* Thumbnails: tighter size when compact */}
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
