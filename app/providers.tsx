'use client';

import { TranslationsProvider } from '@/components/translations-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <TranslationsProvider>{children}</TranslationsProvider>;
}
