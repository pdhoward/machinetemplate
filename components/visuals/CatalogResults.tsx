"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function CatalogResults({ items, compact }: { items?: any[]; compact?: boolean }) {
  const count = Array.isArray(items) ? items.length : 0;
  return (
    <Card className="bg-neutral-900 border-neutral-800 w-full">
      <CardHeader className={compact ? "px-4 py-3" : undefined}>
        <CardTitle className="text-base sm:text-lg">Catalog Results</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-neutral-400">
          Found {count} item{count === 1 ? "" : "s"}. Ask to filter or show details.
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "px-4 pt-0 pb-4" : undefined}>
        <ScrollArea className="max-h-[65dvh] sm:max-h-[360px] pr-2">
          <div className="grid gap-3">
            {count === 0 ? (
              <div className="text-sm text-neutral-400">No items to display.</div>
            ) : (
              items!.map((it: any, i: number) => (
                <Card key={i} className="bg-neutral-950 border-neutral-800">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-medium text-neutral-100 truncate">
                          {it.title || it.name || it.id || `Item ${i + 1}`}
                        </div>
                        {it.type ? <div className="text-xs sm:text-sm text-neutral-400 mt-0.5">{it.type}</div> : null}
                        {it.description ? (
                          <div className="text-xs sm:text-sm text-neutral-400 mt-1 line-clamp-2">{it.description}</div>
                        ) : null}
                      </div>
                      {it.tags && Array.isArray(it.tags) ? (
                        <div className="flex flex-wrap gap-1 shrink-0 max-w-[50%] sm:max-w-none">
                          {it.tags.map((t: string) => (
                            <Badge key={t} variant="secondary" className="bg-neutral-800 text-neutral-300">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
