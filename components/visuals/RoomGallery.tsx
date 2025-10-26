"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  BedDouble,
  Bath,
  Users,
  Eye,
  Ruler,
  MapPin,
  Wifi,
  Image as ImageIcon,
} from "lucide-react";
import type { UnitDoc } from "@/types/units.schema";

/* ---------------------------------------------------------
 * Types & utils (minimal)
 * --------------------------------------------------------- */

export type UnitImage = {
  url: string;
  role?: string;
  alt?: string;
  caption?: string;
  order?: number | { $numberInt?: string };
};

const formatCurrency = (amount?: number, currency = "USD") => {
  if (typeof amount !== "number") return undefined;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
};

const bedsSummary = (
  beds?: { size: string; count: number }[]
): string | undefined => {
  if (!beds?.length) return undefined;
  return beds.map((b) => `${b.count} ${b.size}`).join(", ");
};

const pickPrimaryImage = (images?: UnitImage[]): UnitImage | undefined => {
  if (!images || images.length === 0) return undefined;
  const isVideo = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  const galleryPhoto = [...images]
    .filter(
      (i) => (i.role === "hero" || i.role === "gallery") && !isVideo(i.url)
    )
    .sort(
      (a, b) =>
        Number((a as any).order?.$numberInt ?? a.order ?? 1) -
        Number((b as any).order?.$numberInt ?? b.order ?? 1)
    )[0];
  if (galleryPhoto) return galleryPhoto;
  const anyPhoto = images.find((i) => !isVideo(i.url));
  return anyPhoto ?? images[0];
};

const cx = (...classes: (string | undefined | false)[]) =>
  classes.filter(Boolean).join(" ");

const safeDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

/* ---------------------------------------------------------
 * ReservationConfirmation (unchanged except tiny cleanup)
 * --------------------------------------------------------- */

export function ReservationConfirmation({
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
    <div
      className={cx(
        "grid gap-1 sm:grid-cols-2 sm:items-baseline py-2",
        last ? undefined : "border-b border-neutral-800"
      )}
    >
      <span className="text-neutral-400 text-sm sm:text-base">{label}</span>
      <span className="font-medium text-neutral-200 break-words text-sm sm:text-base">
        {value ?? "—"}
      </span>
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

/* ---------------------------------------------------------
 * Room (compact, essential facts, robust guards + placeholder)
 * --------------------------------------------------------- */

export default function Room({
  unit,
  dates,
  compact = true,
  onViewGallery,
  onAskMore,
}: {
  unit?: UnitDoc | null; // ← tolerate missing unit to avoid runtime errors
  dates?: { check_in?: string; check_out?: string };
  compact?: boolean;
  onViewGallery?: () => void;
  onAskMore?: () => void;
}) {

  const [imgLoaded, setImgLoaded] = React.useState(false);
 
  // Guard: missing unit
  if (!unit) {
    return (
      <Card className="bg-neutral-900 border-neutral-800 w-full mx-auto sm:max-w-[860px]">
        <CardHeader className={cx("gap-1", compact ? "px-4 py-3" : undefined)}>
          <CardTitle className="text-lg sm:text-xl leading-tight">
            Room details unavailable
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-neutral-400">
            I couldn’t load this villa right now. Try again or ask for another villa.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const img = pickPrimaryImage(unit.images); // images is optional in schema
  const rate = unit.rate; // number (validated)
  const sqft = unit.config?.squareFeet; // required in schema; guarded anyway
  const beds = bedsSummary(unit.config?.beds);
  const bedrooms = unit.config?.bedrooms;
  const baths = unit.config?.bathrooms;
  const sleeps = unit.occupancy?.sleeps; // occupancy is optional
  const currency = unit.currency || "USD";
  const price = formatCurrency(rate, currency);

  const wellness = unit.amenities?.wellness?.slice(0, 2) ?? [];
  const hasWifi = unit.tech?.wifi?.available === true;
  const view = unit.config?.view || unit.amenities?.view?.[0];

   React.useEffect(() => {
      setImgLoaded(false);
    }, [img?.url]);


  return (
    <Card
      className={cx(
        "bg-neutral-900 border-neutral-800 w-full mx-auto",
        compact ? "sm:max-w-[860px]" : "sm:max-w-[1040px]"
      )}
    >
      {/* Media: photo if available; otherwise a tasteful placeholder */}
      {img ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl">
          {/* skeleton shimmer until the image finishes loading */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: imgLoaded ? 0 : 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 bg-neutral-800/40"
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 1.005 }}
            animate={{ opacity: imgLoaded ? 1 : 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute inset-0"
          >
          <Image
            src={img.url}
            alt={img.alt || unit.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 860px"
            priority={false}
            onLoadingComplete={() => setImgLoaded(true)}
          />
        </motion.div>
        </div>
        ) : (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-neutral-900">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800" />
              <div className="relative h-full w-full flex items-center justify-center">
                <div className="flex items-center gap-2 text-neutral-500">
                   <ImageIcon className="h-5 w-5" />
                   <span className="text-sm">No photo available</span>
                 </div>
             </div>
          </div>
        )}

      <CardHeader className={cx("gap-1", compact ? "px-4 py-3" : undefined)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl leading-tight">
              {unit.name}
              {unit.unitNumber ? (
                <span className="text-neutral-400 font-normal"> · #{unit.unitNumber}</span>
              ) : null}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-neutral-400">
              {unit.type ? unit.type.charAt(0).toUpperCase() + unit.type.slice(1) : ""}
              {view ? ` · ${String(view).toLowerCase()} view` : ""}
              {unit.location?.city ? ` · ${unit.location.city}, ${unit.location.state ?? ""}` : ""}
            </CardDescription>
          </div>
          {price && (
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-semibold">{price}</div>
              <div className="text-neutral-400 text-xs">per night</div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className={cx("space-y-4", compact ? "px-4 pb-4 pt-0" : undefined)}>
        {/* Key facts row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {typeof sqft === "number" ? (
            <Fact icon={Ruler} label="Square feet" value={`${sqft.toLocaleString()}`} />
          ) : null}
          {beds ? <Fact icon={BedDouble} label="Beds" value={beds} /> : null}
          {typeof bedrooms === "number" ? (
            <Fact icon={BedDouble} label="Bedrooms" value={`${bedrooms}`} />
          ) : null}
          {typeof baths === "number" ? <Fact icon={Bath} label="Bathrooms" value={`${baths}`} /> : null}
          {typeof sleeps === "number" ? <Fact icon={Users} label="Sleeps" value={`${sleeps}`} /> : null}
          {hasWifi ? <Fact icon={Wifi} label="Wi-Fi" value="Included" /> : null}
        </div>

        {/* Dates (if provided) */}
        {(dates?.check_in || dates?.check_out) && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
            <div className="flex items-center gap-2 text-neutral-300 text-sm">
              <CalendarDays className="h-4 w-4" />
              <span>
                {safeDate(dates?.check_in)} → {safeDate(dates?.check_out)}
              </span>
            </div>
          </div>
        )}

        {/* Micro description */}
        {unit.description && (
          <p className="text-sm text-neutral-300 leading-relaxed line-clamp-3">
            {unit.description}
          </p>
        )}

        <Separator className="bg-neutral-800" />

        {/* Amenity highlights */}
        <div className="flex flex-wrap gap-2">
          {wellness.map((w) => (
            <Badge key={w} variant="secondary" className="bg-neutral-800 text-neutral-200">
              {w}
            </Badge>
          ))}
          {view && (
            <Badge variant="secondary" className="bg-neutral-800 text-neutral-200">
              View · {String(view)}
            </Badge>
          )}
          {(unit.amenities?.outdoor ?? []).slice(0, 1).map((o) => (
            <Badge key={o} variant="secondary" className="bg-neutral-800 text-neutral-200">
              {o}
            </Badge>
          ))}
          {unit.location?.city && (
            <Badge variant="secondary" className="bg-neutral-800 text-neutral-200">
              <MapPin className="h-3.5 w-3.5 mr-1" />
              {unit.location.city}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onViewGallery && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-neutral-800 text-neutral-100"
              onClick={onViewGallery}
              disabled={(unit.images?.length ?? 0) === 0}
              aria-disabled={(unit.images?.length ?? 0) === 0}
            >
              <Eye className="h-4 w-4 mr-2" />
              View gallery
              {(unit.images?.length ?? 0) > 0 ? ` (${unit.images!.length})` : ""}
            </Button>
          )}
          {onAskMore && (
            <Button size="sm" variant="ghost" className="text-neutral-300 hover:text-white" onClick={onAskMore}>
              Ask for more details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="flex items-center gap-2 text-neutral-300 text-sm">
        <Icon className="h-4 w-4" />
        <span className="text-neutral-400">{label}</span>
      </div>
      <div className="mt-1 font-medium text-neutral-100 text-sm">{value}</div>
    </div>
  );
}
