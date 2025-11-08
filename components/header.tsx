"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from 'next/image';
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MobileNav } from "./mobile-nav";
import { Badge } from "./ui/badge";
import { siteConfig } from "@/config/site";
import { TwitterIcon, StarIcon, BookOpen } from "lucide-react"; 
import { motion } from "framer-motion";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslations } from "@/context/translations-context";
import { AccessGate } from "@/components/security/access-gate";

import DocsGateButton from "@/components/docs/DocsGateButton";


export function Header() {
  const { t } = useTranslations();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full sticky top-10 mt-10 z-[90] border-b bg-background"
    >
      <div className="container mx-auto px-4 h-12 flex items-center justify-between gap-2">
        <MobileNav />

        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-md:hidden flex items-center"
        >
          <Link
            href="/"
            className="flex gap-3 items-center"
            
          >
            <motion.h1
              className="text-lg font-medium tracking-tighter flex gap-1 items-center"
              whileHover={{ scale: 1.02 }}
            >
              <Image
                src="https://res.cloudinary.com/stratmachine/image/upload/v1592332363/machine/icon-512x512_zaffp5.png"
                alt="Strategic Machines Logo"
                width={40}
                height={40}
                className="h-10 w-10"
              />
              <span className=" text-lg text-white">Strategic Machines</span>
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Badge variant="outline" className="text-normal">
                {t("header.beta")}
              </Badge>
            </motion.div>
          </Link>
        </motion.nav>

        {/* Right controls */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3 items-center justify-end ml-auto"
        >
          {/* 🔐 Compact OTP access widget */}
          <AccessGate />

          <LanguageSwitcher />

          {/* GitHub */}
          <Link
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Give a star on GitHub"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                className="flex gap-3 items-center max-md:h-9 max-md:w-9 max-md:px-0"
                aria-label="Give a star on GitHub"
              >
                <span className="hidden md:block text-xs">{t("header.github")}</span>{" "}
                <StarIcon className="motion-preset-spin motion-loop-twice" />
              </Button>
            </motion.div>
          </Link>

          {/* Twitter */}
          <Link
            href={siteConfig.links.twitter}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Follow on Twitter"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                className="flex gap-3 items-center max-md:h-9 max-md:w-9 max-md:px-0"
                aria-label="Follow on Twitter"
              >
                <span className="hidden md:block text-xs">{t("header.twitter")}</span>{" "}
                <TwitterIcon />
              </Button>
            </motion.div>
          </Link>

          {/* ✅ Docs (gated on mobile) */}
          <DocsGateButton />         

          <ThemeSwitcher />
        </motion.div>
      </div>
    </motion.header>
  );
}
