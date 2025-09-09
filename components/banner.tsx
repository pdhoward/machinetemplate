// components/banner.tsx
"use client";

import { useTranslations } from "@/context/translations-context";

export default function Banner() {
  const { t } = useTranslations();

  return (
    <div className="fixed top-0 inset-x-0 z-[100] h-10 flex items-center bg-gradient-to-r from-gray-900 to-gray-700">
      <div className="container mx-auto px-4 text-center text-white text-sm">
        {t("header.banner")}
        <a
          href="https://www.strategicmachines.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline ml-2 hover:text-gray-200"
        >
          {t("header.bannerLink")}
        </a>
      </div>
    </div>
  );
}


