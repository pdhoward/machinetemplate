// components/docs/BackToTop.tsx
"use client";

import { useEffect, useState } from "react";

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-4 z-40 rounded-full border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70"
      aria-label="Back to top"
    >
      Back to top
    </button>
  );
}
