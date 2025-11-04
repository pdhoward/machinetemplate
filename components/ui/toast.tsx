"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Export the Radix Provider as-is so you can wrap a <Toaster/> at app root.
 */
const ToastProvider = ToastPrimitives.Provider;

/* ----------------------------------------------------------------------------
 * Viewport
 * -------------------------------------------------------------------------- */

type ViewportRef = React.ElementRef<typeof ToastPrimitives.Viewport>;
type ViewportProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>;

const ToastViewport = React.forwardRef<ViewportRef, ViewportProps>(
  ({ className, ...props }, ref) => (
    <ToastPrimitives.Viewport
      ref={ref}
      className={cn(
        // Mobile: top
        "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4",
        // Desktop: bottom-right
        "sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
        className
      )}
      {...props}
    />
  )
);
ToastViewport.displayName = "ToastViewport";

/* ----------------------------------------------------------------------------
 * Root (Toast)
 * -------------------------------------------------------------------------- */

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden",
    "rounded-md border p-6 pr-8 shadow-lg transition-all",
    // Animator states
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
    "data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "mb-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "border-destructive/40 bg-destructive text-destructive-foreground " +
          "data-[state=open]:ring-1 data-[state=open]:ring-destructive/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type ToastRootRef = React.ElementRef<typeof ToastPrimitives.Root>;
type ToastRootProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    /** Provide assertive for high-priority/destructive toasts (a11y). */
    "aria-live"?: "off" | "polite" | "assertive";
  };

const Toast = React.forwardRef<ToastRootRef, ToastRootProps>(
  ({ className, variant, ...props }, ref) => {
    // Default a11y behavior: destructive → assertive, others → polite
    const ariaLive =
      props["aria-live"] ?? (variant === "destructive" ? "assertive" : "polite");

    return (
      <ToastPrimitives.Root
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        aria-live={ariaLive}
        {...props}
      />
    );
  }
);
Toast.displayName = "Toast";

/* ----------------------------------------------------------------------------
 * Title / Description
 * -------------------------------------------------------------------------- */

type TitleRef = React.ElementRef<typeof ToastPrimitives.Title>;
type TitleProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>;

const ToastTitle = React.forwardRef<TitleRef, TitleProps>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
ToastTitle.displayName = "ToastTitle";

type DescriptionRef = React.ElementRef<typeof ToastPrimitives.Description>;
type DescriptionProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>;

const ToastDescription = React.forwardRef<DescriptionRef, DescriptionProps>(
  ({ className, ...props }, ref) => (
    <ToastPrimitives.Description
      ref={ref}
      className={cn("text-sm opacity-90", className)}
      {...props}
    />
  )
);
ToastDescription.displayName = "ToastDescription";

/* ----------------------------------------------------------------------------
 * Action / Close
 * -------------------------------------------------------------------------- */

type ActionRef = React.ElementRef<typeof ToastPrimitives.Action>;
type ActionProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>;

const ToastAction = React.forwardRef<ActionRef, ActionProps>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3",
      "text-sm font-medium ring-offset-background transition-colors hover:bg-secondary",
      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      // Variants on destructive root
      "group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30",
      "group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground",
      "group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

type CloseRef = React.ElementRef<typeof ToastPrimitives.Close>;
type CloseProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>;

const ToastClose = React.forwardRef<CloseRef, CloseProps>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity",
      "hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2",
      "group-hover:opacity-100",
      // On destructive root:
      "group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50",
      "group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = "ToastClose";

/* ----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
