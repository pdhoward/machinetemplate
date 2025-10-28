"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Ruler, BedDouble, Bath, Wifi, Eye, ArrowLeft } from "lucide-react";
import type { UnitDoc } from "@/types/units.schema";
import RoomGallery from "./RoomGallery";

type Props = {
  items: UnitDoc[];
  dates?: { check_in?: string; check_out?: string };
  highlight?: string;
  onClose?: () => void; // optional: allow parent to close the list
};
// components/rooms/RoomList.tsx (excerpt)

export default function RoomList({ items, dates, highlight, onClose }: Props) {
  const [selected, setSelected] = React.useState<UnitDoc | null>(null);

  const handleSelect = (u: UnitDoc) => {
    setSelected(u);
  };

  const handleBack = () => {
    setSelected(null);
  };

  return (
    <div className="relative">
      {selected ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-neutral-400 hover:text-neutral-100"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
              </Button>
              <h2 className="text-xl font-bold text-white">Room Details</h2>
            </div>
            {onClose && (
              <button
                aria-label="Close list"
                title="Close list"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
              >
                ×
              </button>
            )}
          </div>
          <RoomGallery
            unit={selected}
            dates={dates}
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Available Units</h2>
            {onClose && (
              <button
                aria-label="Close list"
                title="Close list"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
              >
                ×
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((u) => (
              <UnitCard
                key={u.unit_id}
                unit={u}
                dates={dates}
                emphasize={!!(highlight && u.name.toLowerCase().includes(highlight.toLowerCase()))}
                onClick={() => handleSelect(u)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ----------------------- Small card used in the grid ----------------------- */

function UnitCard({
  unit,
  dates,
  emphasize,
  onClick,
}: {
  unit: UnitDoc;
  dates?: { check_in?: string; check_out?: string };
  emphasize?: boolean;
  onClick?: () => void;
}) {
  const img = pickPrimaryImage(unit.images);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const price = formatCurrency(unit.rate, unit.currency || "USD");
  const sqft = unit.config?.squareFeet;
  const beds = unit.config?.beds?.map((b) => `${b.count} ${b.size}`).join(", ");
  const baths = unit.config?.bathrooms;
  const hasWifi = unit.tech?.wifi?.available === true;

  return (
    <Card className={`bg-neutral-900 border-neutral-800 overflow-hidden ${emphasize ? "ring-2 ring-amber-400/60" : ""}`}>
      {/* Media (kept; responsive) */}
      {img ? (
        <div className="relative aspect-[16/9] w-full">
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
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
              onLoad={() => setImgLoaded(true)}
            />
          </motion.div>
        </div>
      ) : (
        <div className="relative aspect-[16/9] w-full bg-neutral-900">
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800" />
          <div className="relative h-full w-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-neutral-500">
              <ImageIcon className="h-5 w-5" />
              <span className="text-sm">No photo available</span>
            </div>
          </div>
        </div>
      )}

      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight truncate">
              {unit.name} {unit.unitNumber && <span className="text-neutral-400 font-normal">· #{unit.unitNumber}</span>}
            </CardTitle>
            <CardDescription className="text-xs text-neutral-400 truncate">
              {unit.type?.[0]?.toUpperCase() + unit.type?.slice(1) || "Villa"}
              {unit.config?.view ? ` · ${String(unit.config.view).toLowerCase()} view` : ""}
              {unit.location?.city ? ` · ${unit.location.city}, ${unit.location.state ?? ""}` : ""}
            </CardDescription>
          </div>
          {price && (
            <div className="text-right shrink-0">
              <div className="text-lg font-semibold">{price}</div>
              <div className="text-neutral-400 text-[11px]">per night</div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {typeof sqft === "number" && <MiniFact icon={Ruler} label={`${sqft.toLocaleString()} ft²`} />}
          {beds && <MiniFact icon={BedDouble} label={beds} />}
          {typeof baths === "number" && <MiniFact icon={Bath} label={`${baths} bath${baths > 1 ? "s" : ""}`} />}
          {hasWifi && <MiniFact icon={Wifi} label="Wi-Fi" />}
        </div>

        {(unit.amenities?.wellness ?? []).slice(0, 2).map((w) => (
          <Badge key={w} variant="secondary" className="bg-neutral-800 text-neutral-200 mr-2">
            {w}
          </Badge>
        ))}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-neutral-400">
            {dates?.check_in || dates?.check_out ? `${dates?.check_in ?? "—"} → ${dates?.check_out ?? "—"}` : null}
          </div>
          <Button size="sm" variant="secondary" className="bg-neutral-800 text-neutral-100" onClick={onClick}>
            <Eye className="h-4 w-4 mr-1" /> Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniFact({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-neutral-300">
      <Icon className="h-4 w-4" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function pickPrimaryImage(images?: { url: string; role?: string; alt?: string; order?: number }[]) {
  if (!images?.length) return undefined;
  const isVideo = (url: string) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  const galleryPhoto = [...images]
    .filter((i) => (i.role === "hero" || i.role === "gallery") && !isVideo(i.url))
    .sort((a, b) => (a.order ?? 1) - (b.order ?? 1))[0];
  return galleryPhoto ?? images.find((i) => !isVideo(i.url)) ?? images[0];
}

function formatCurrency(amount?: number, currency = "USD") {
  if (typeof amount !== "number") return undefined;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}