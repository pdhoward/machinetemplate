// components/docs/mdx-parts.tsx

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
    <Card className="my-6">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
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

// export a few shadcn primitives for mdx
export { 
    Card, 
    CardHeader, 
    CardTitle, 
    CardDescription, 
    CardContent, 
    Badge, 
    Separator 
};
