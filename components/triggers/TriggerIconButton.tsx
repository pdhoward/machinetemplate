"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  className?: string;
  children: React.ReactNode;
};

export default function TriggerIconButton({ title, className = "", children, ...rest }: Props) {
  return (
    <button
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-full bg-neutral-600 hover:bg-neutral-500 text-white w-7 h-7 focus:outline-none focus:ring-1 focus:ring-neutral-500 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
