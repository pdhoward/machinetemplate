// components/docs/DocsHeaderBar.tsx
import Link from "next/link";
import { Calendar as CalendarIcon} from "lucide-react";
import { SiGithub } from "react-icons/si";
import { Button } from "@/components/ui/button";

type DocsHeaderBarProps = {  
  githubUrl?: string;  
  rightSlot?: React.ReactNode;  
  subtitle?: string;
};

export default function DocsHeaderBar({
  githubUrl,
  rightSlot,
  subtitle = "Documentation",
}: DocsHeaderBarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-3">
        {/* Brand → back to Home */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded px-1 py-1 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Go to Home"
            title="Home"
          >
            <CalendarIcon className="h-5 w-5" aria-hidden="true" />
            <span className="font-semibold tracking-tight">Booking Engine</span>
          </Link>

          {/* Divider dot + subtitle */}
          <span className="text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {githubUrl && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={githubUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on GitHub">
                 <SiGithub className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Open on GitHub</span>
              </Link>
            </Button>
          )}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}
