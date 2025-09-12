// /lib/things/view.ts
import type { ThingBase } from "@/types/things.schema";

export type ThingView = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  media?: { url: string; alt?: string; kind?: "image" | "video" }[];
  price?: { amount: number; currency?: string; unit?: string };
  locationText?: string;
  badge?: string;
  props: Record<string, unknown>;
};

export function toThingView(doc: ThingBase): ThingView {
  const title = (doc as any).name ?? (doc as any).title ?? doc.id;
  const description =
    (doc as any).description ??
    (Array.isArray((doc as any).amenities) ? (doc as any).amenities.join(", ") : undefined);

  const media =
    Array.isArray((doc as any).media)
      ? (doc as any).media.map((m: any) => ({ url: m.url, alt: m.alt, kind: m.kind }))
      : Array.isArray((doc as any).images)
        ? (doc as any).images.map((m: any) => ({ url: m.src, alt: m.alt, kind: "image" }))
        : undefined;

  const price = typeof (doc as any).price === "number"
    ? { amount: (doc as any).price, currency: (doc as any).currency }
    : typeof (doc as any).rate === "number"
      ? { amount: (doc as any).rate, currency: (doc as any).currency, unit: "night" }
      : undefined;

  const loc = (doc as any).location;
  const locationText =
    loc?.city && loc?.state ? `${loc.city}, ${loc.state}` :
    loc?.city ?? loc?.state ?? undefined;

  const badge = (doc as any).code ?? (doc as any).status;

  const { id, tenantId, type, ...rest } = doc as Record<string, unknown>;

  return {
    id: doc.id,
    type: doc.type,
    title,
    subtitle: (doc as any).slug,
    description,
    media,
    price,
    locationText,
    badge,
    props: rest,
  };
}
