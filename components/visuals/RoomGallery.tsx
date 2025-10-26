"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Ruler, BedDouble, Bath, Users, Wifi, MapPin, Image as ImageIcon } from "lucide-react";
import type { UnitDoc } from "@/types/units.schema";

/* ------------------------------ helpers ------------------------------ */

function formatCurrency(amount?: number, currency = "USD") {
  if (typeof amount !== "number") return undefined;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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


export default function RoomGallery({
  unit,
  dates,
}: {
  unit: UnitDoc;
  dates?: { check_in?: string; check_out?: string };
}) {
  const images = (unit.images ?? []).filter(Boolean);
  const [heroIdx, setHeroIdx] = React.useState(0);
  const hero = images[heroIdx];
  const [loaded, setLoaded] = React.useState(false);

  const price = formatCurrency(unit.rate, unit.currency || "USD");
  const sqft = unit.config?.squareFeet;
  const beds = unit.config?.beds?.map((b) => `${b.count} ${b.size}`).join(", ");
  const baths = unit.config?.bathrooms;
  const sleeps = unit.occupancy?.sleeps;
  const hasWifi = unit.tech?.wifi?.available === true;
  const view = unit.config?.view || unit.amenities?.view?.[0];

  // ensure hero index stays in range if images array changes
  React.useEffect(() => {
    if (heroIdx > images.length - 1) setHeroIdx(0);
    setLoaded(false);
  }, [heroIdx, images.length]);

  return (
    <Card className="bg-neutral-950 border-neutral-800 w-full">
      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl leading-tight">
              {unit.name} {unit.unitNumber && <span className="text-neutral-400 font-normal">· #{unit.unitNumber}</span>}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-neutral-400">
              {unit.type?.[0]?.toUpperCase() + unit.type?.slice(1) || "Villa"}
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

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Hero media */}
        {hero ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: loaded ? 0 : 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 bg-neutral-800/40"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 1.005 }}
              animate={{ opacity: loaded ? 1 : 0, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image
                src={hero.url}
                alt={hero.alt || unit.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
                onLoadingComplete={() => setLoaded(true)}
              />
            </motion.div>
          </div>
        ) : (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-neutral-900">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800" />
            <div className="relative h-full w-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-neutral-500">
                <ImageIcon className="h-5 w-5" />
                <span className="text-sm">No photo available</span>
              </div>
            </div>
          </div>
        )}

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pt-1">
            {images.map((m, i) => (
              <button
                key={`${m.url}-${i}`}
                onClick={() => setHeroIdx(i)}
                className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border ${i === heroIdx ? "border-amber-400/70" : "border-neutral-800"}`}
                aria-label={`Thumbnail ${i + 1}`}
              >
                <Image
                  src={m.url}
                  alt={m.alt || unit.name}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              </button>
            ))}
          </div>
        )}

        {/* Facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {typeof sqft === "number" && <Fact icon={Ruler} label="Square feet" value={`${sqft.toLocaleString()}`} />}
          {beds && <Fact icon={BedDouble} label="Beds" value={beds} />}
          {typeof baths === "number" && <Fact icon={Bath} label="Bathrooms" value={`${baths}`} />}
          {typeof sleeps === "number" && <Fact icon={Users} label="Sleeps" value={`${sleeps}`} />}
          {hasWifi && <Fact icon={Wifi} label="Wi-Fi" value="Included" />}
        </div>

        {/* Description */}
        {unit.description && (
          <p className="text-sm text-neutral-300 leading-relaxed">{unit.description}</p>
        )}

        <Separator className="bg-neutral-800" />

        {/* Amenity highlights */}
        <div className="flex flex-wrap gap-2">
          {(unit.amenities?.wellness ?? []).slice(0, 3).map((w) => (
            <Badge key={w} variant="secondary" className="bg-neutral-800 text-neutral-200">
              {w}
            </Badge>
          ))}
          {unit.config?.view && (
            <Badge variant="secondary" className="bg-neutral-800 text-neutral-200">
              View · {String(unit.config.view)}
            </Badge>
          )}
          {(unit.amenities?.outdoor ?? []).slice(0, 2).map((o) => (
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

        {/* Dates */}
        {dates && (dates.check_in || dates.check_out) && (
          <div className="text-xs text-neutral-400">
            {dates.check_in ?? "—"} → {dates.check_out ?? "—"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

