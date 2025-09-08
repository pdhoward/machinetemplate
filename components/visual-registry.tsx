// components/visual-registry.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---- Registry (name -> React component) ----
const registry: Record<string, React.ComponentType<any>> = {
  payment_form: PaymentForm,
  // gallery: GalleryComponent,
  // room_details: RoomDetails,
};

export function getVisualComponent(name: string) {
  return registry[name];
}

// ---- Example Payment Form (skeleton) ----
function PaymentForm({ onSubmit }: { onSubmit?: (data: any) => void }) {
  const [loading, setLoading] = React.useState(false);

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        const data = Object.fromEntries(fd.entries());
        try {
          onSubmit?.(data);
          // your real payment flow here
          await new Promise((r) => setTimeout(r, 600));
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Name on card</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="number">Card number</Label>
        <Input id="number" name="number" inputMode="numeric" placeholder="4242 4242 4242 4242" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="exp">Expiry</Label>
          <Input id="exp" name="exp" placeholder="MM/YY" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cvc">CVC</Label>
          <Input id="cvc" name="cvc" placeholder="123" required />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="mt-2 w-full">
        {loading ? "Processing…" : "Pay now"}
      </Button>
    </form>
  );
}
