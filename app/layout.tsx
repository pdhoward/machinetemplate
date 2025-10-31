// app/layout.tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { siteConfig } from "@/config/site";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import Providers from "./providers";
import ToolRegistryPanel from '@/components/ToolRegistryPanel';
import Banner from "@/components/banner"; // default export above
import { BotIdClient } from "botid/client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const protectedRoutes = [
  {
    path: '/api/session',
    method: 'POST',
  },
];

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Strategic Machines | Agents",
  description:
    "Strategic Machines is an AI-first company, delivering AI Agents for business.",
  keywords:
    "Strategic Machines, AI, Voice Agents, Ai Business Apps AI Development, AI Automation, Language Models, OpenAI, Anthropic, Hugging Face",
  openGraph: {
    title: "Strategic Machines | AI Agents",
    siteName: "Strategic Machines",
    url: "https://www.strategicmachines.ai/",
    images: [
      {
        url: "https://res.cloudinary.com/stratmachine/image/upload/v1592332360/machine/icon-384x384_liietq.png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
     <head>
        <BotIdClient protect={protectedRoutes}  />
      </head>
      <body
        className={cn(
          "min-h-dvh bg-background font-sans antialiased",
          geistSans.variable
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <Providers>           
            <div className="relative flex min-h-dvh flex-col bg-background items-center">
              <Banner />
              <Header />
              <main className="flex flex-1 justify-center items-start">
                {children}
              </main>
            </div>

            <Toaster />
            <ToolRegistryPanel />
          </Providers>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
