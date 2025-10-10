// components/docs/mdx-parts.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* --- EXISTING CODE (Pre, InlineCode, StepCard, Callout, exports) --- */

// Simple code/pre wrappers
export function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-lg border bg-muted p-3 text-sm">
      {children}
    </pre>
  );
}
export function InlineCode(props: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      {...props}
      className={cn("rounded bg-muted px-1 py-0.5 text-[0.9em]", props.className)}
    />
  );
}

// Nice “step” card
export function StepCard(props: { title: string; description?: string; children?: React.ReactNode }) {
  const { title, description, children } = props;
  return (
    <Card className="my-6 not-prose">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="prose prose-zinc dark:prose-invert max-w-none">{children}</CardContent>
    </Card>
  );
}

// Callout box
export function Callout({ title = "Note", variant, children }: {
  title?: string; variant?: "default" | "destructive"; children?: React.ReactNode;
}) {
  return (
    <Alert variant={variant ?? "default"} className="my-4">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/* --- NEW: Styled table primitives for MDX markdown tables --- */

export function MdxTable(props: React.HTMLAttributes<HTMLTableElement>) {
  // Wrap the table so borders round correctly and it scrolls on mobile
  return (
    <div className="my-4 overflow-x-auto rounded-xl border bg-background/40 shadow-sm">
      <table
        {...props}
        className={cn(
          "w-full border-collapse text-sm",
          // remove prose default spacing that can misalign cells
          "[&_*]:!my-0 [&_*]:!mt-0 [&_*]:!mb-0",
          props.className
        )}
      />
    </div>
  );
}

export function MdxThead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn("bg-muted/60", props.className)} />;
}

export function MdxTbody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn("", props.className)} />;
}

export function MdxTr(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn("border-b last:border-0", props.className)} />;
}

export function MdxTh(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn(
        "border px-3 py-2 text-left font-semibold align-middle",
        "bg-muted/40",
        props.className
      )}
    />
  );
}

export function MdxTd(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={cn(
        "border px-3 py-2 align-top",
        props.className
      )}
    />
  );
}

// export a few shadcn primitives for mdx
export {
  Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Separator
};
