// components/visuals/registry.tsx
"use client";

import React from "react";

// A Visual is a default-exported React component
type VisualAny = React.ComponentType<any>;

// Loader returns a module with default export
export type VisualLoader = () => Promise<{ default: VisualAny }>;

const loaders: Record<string, VisualLoader> = {
  // seed with your common ones; each lives in its own file
  media_gallery: () => import("./MediaGallery"),
  image_viewer: () => import("./ImageViewer"),
  video: () => import("./VideoPlayer"),
  room: () => import("./RoomGallery"),
  quote_summary: () => import("./QuoteSummary"),
  catalog_results: () => import("./CatalogResults"),
  reservation_confirmation: () => import("./ReservationConfirmation"),
  payment_form: () => import("./PaymentForm"),
};

// Allow dynamic plugins/extensions at runtime (client-side)
export function registerVisualComponent(name: string, loader: VisualLoader) {
  loaders[name] = loader;
}

// Get a **lazy** component (or null if not found)
export function getVisualComponent(name: string): React.LazyExoticComponent<VisualAny> | null {
  const loader = loaders[name];
  if (!loader) return null;
  return React.lazy(loader);
}

/** Optional: prewarm a visual chunk before first render */
/*
// Example usage:
import { preloadVisual } from "@/components/visuals/registry";

useEffect(() => {
  // prewarm common visuals for faster first paint
  preloadVisual("media_gallery");
  preloadVisual("payment_form");
}, []);

*/
const cache = new Map<string, Promise<any>>();
export function preloadVisual(name: string) {
  const loader = loaders[name];
  if (!loader) return;
  if (!cache.has(name)) cache.set(name, loader());
  return cache.get(name)!;
}

// safe list (optional)
export function listRegisteredVisuals() {
  return Object.keys(loaders).sort();
}
