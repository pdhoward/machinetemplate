"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "success" | "danger" | "warning";
type Size = "sm" | "md";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  className?: string;
  children: React.ReactNode;
  variant?: Variant; 
  size?: Size;      
};

const variantClasses: Record<Variant, string> = {
  neutral: "bg-neutral-600 hover:bg-neutral-500",
  success: "bg-emerald-600 hover:bg-emerald-500",
  danger:  "bg-red-600 hover:bg-red-500",
  warning: "bg-yellow-500 hover:bg-yellow-400",
};

const sizeClasses: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
};

export default function TriggerIconButton({
  title,
  className = "",
  children,
  variant = "neutral",
  size = "sm",
  ...rest
}: Props) {
  return (
    <button
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white",
        "focus:outline-none focus:ring-1 focus:ring-neutral-500",
        sizeClasses[size],
        variantClasses[variant], 
        className                
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
