// components/visual-stage-host.tsx
"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ShowArgs = {
  component_name: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  props?: any;
  media?: { type: "image" | "video"; src: string };
  url?: string;
};

export type VisualStageHandle = {
  show: (args: ShowArgs) => void;
  openComponent: (component: string, props?: any) => void;
  close: () => void;
};

type Registry = Record<
  string,
  React.ComponentType<any> | ((p: any) => React.ReactNode)
>;

type Props = {
  /** Optional custom registry; you can also keep using the default below */
  registry?: Registry;
};

const DefaultPayment: React.FC<{ fromAction?: string }> = ({ fromAction }) => (
  <div className="space-y-2">
    <div className="text-sm text-neutral-400">
      Secure payment form (demo). From action:{" "}
      <span className="font-mono">{fromAction ?? "—"}</span>
    </div>
    <div className="grid gap-2">
      <input
        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
        placeholder="Cardholder name"
      />
      <input
        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
        placeholder="Email"
      />
      <div className="bg-neutral-800 border border-neutral-700 rounded px-2 py-3 text-sm text-neutral-400">
        [ PSP card element here ]
      </div>
      <button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1.5 text-sm">
        Pay now
      </button>
    </div>
  </div>
);

const DefaultMenu: React.FC = () => (
  <div className="space-y-1 text-sm text-neutral-300">
    <div>Chef’s Tasting — $95</div>
    <div>Truffle Risotto — $28</div>
    <div>Local Trout — $32</div>
  </div>
);

const DefaultRoomGallery: React.FC = () => (
  <div className="grid grid-cols-3 gap-2">
    <div className="h-24 bg-neutral-800 rounded" />
    <div className="h-24 bg-neutral-800 rounded" />
    <div className="h-24 bg-neutral-800 rounded" />
  </div>
);

const baseRegistry: Registry = {
  payment: DefaultPayment,
  menu: DefaultMenu,
  room: DefaultRoomGallery,
  spa_pricing: () => (
    <div className="text-sm text-neutral-300">
      Deep Tissue $160 · Swedish $140 · Couples $280
    </div>
  ),
  waterfall_video: ({ src = "/videos/waterfall.mp4" }) => (
    <video className="w-full rounded-lg border border-neutral-800" src={src} controls />
  ),
};

function computeWidth(size?: ShowArgs["size"]) {
  switch (size) {
    case "sm":
      return "w-[380px]";
    case "lg":
      return "w-[720px]";
    case "xl":
      return "w-[960px]";
    case "md":
    default:
      return "w-[520px]";
  }
}

const VisualStageHost = forwardRef<VisualStageHandle, Props>(
  ({ registry }, ref) => {
    const [open, setOpen] = useState(false);
    const [payload, setPayload] = useState<ShowArgs | null>(null);

    const reg = useMemo(() => ({ ...baseRegistry, ...(registry || {}) }), [registry]);

    const show = (args: ShowArgs) => {
      setPayload(args);
      setOpen(true);
    };

    const openComponent = (component: string, props?: any) => {
      show({ component_name: component, props });
    };

    const close = () => setOpen(false);

    useImperativeHandle(ref, () => ({ show, openComponent, close }), []);

    const Comp = payload ? (reg[payload.component_name] as any) : null;
    const widthClass = computeWidth(payload?.size);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={`bg-neutral-900 text-neutral-200 border border-neutral-800 max-w-[95vw] ${widthClass}`}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{payload?.title ?? "Preview"}</span>
            </DialogTitle>
          </DialogHeader>

          {payload?.description ? (
            <p className="text-sm text-neutral-400 mb-2">{payload.description}</p>
          ) : null}

          {/* Priority: component -> media -> url -> empty */}
          {Comp ? (
            <div className="mt-1"><Comp {...(payload?.props || {})} /></div>
          ) : payload?.media ? (
            payload.media.type === "image" ? (
              <img
                src={payload.media.src}
                alt=""
                className="rounded-lg border border-neutral-800"
              />
            ) : (
              <video
                src={payload.media.src}
                controls
                className="w-full rounded-lg border border-neutral-800"
              />
            )
          ) : payload?.url ? (
            <iframe
              src={payload.url}
              className="w-full h-[60vh] rounded-lg border border-neutral-800"
            />
          ) : (
            <div className="text-sm text-neutral-400">Nothing to display.</div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

export default VisualStageHost;
