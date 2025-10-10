"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  // Tailwind md breakpoint is 768px — match your header’s max-md classes
  return window.matchMedia("(max-width: 767px)").matches;
}

type DocsGateButtonProps = {
  href?: string;
  label?: string;
  buttonClassName?: string;
};

export default function DocsGateButton({
  href = "/docs",
  label = "Docs",
  buttonClassName = "flex gap-3 items-center max-md:h-9 max-md:w-9 max-md:px-0",
}: DocsGateButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState(href);

  const onClick = (e: React.MouseEvent) => {
    // If mobile, show the modal instead of navigating
    if (isMobileViewport()) {
      e.preventDefault();
      setPendingHref(href);
      setOpen(true);
    }
    // else let the Link do its thing
  };

  const continueToDocs = () => {
    setOpen(false);
    // Prefer router for SPA nav
    router.push(pendingHref);
  };

  return (
    <>
      {/* Use Link so middle-click etc. still works on desktop */}
      <Link href={href} aria-label="Open Docs" onClick={onClick}>
        <Button variant="outline" size="sm" className={buttonClassName} aria-label="Open Docs">
          <span className="hidden md:block text-xs">{label}</span>{" "}
          <BookOpen />
        </Button>
      </Link>

      {/* Mobile gate dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Best viewed on desktop</DialogTitle>
            <DialogDescription>
              The documentation is optimized for larger screens. The content is dense, and not sized for mobile.
              You can still open it here, but we recommend a laptop or desktop for the best experience.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={continueToDocs}>Open anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
