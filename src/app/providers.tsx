"use client";

import { LanguageProvider } from "@/context/LanguageContext";
import type { Locale } from "@/lib/i18n";
import { ReactNode } from "react";
import { UploadProvider } from "@/context/UploadContext";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  return (
    <LanguageProvider initialLocale={initialLocale}>
      <SessionProvider>
        <UploadProvider>{children}</UploadProvider>
      </SessionProvider>
    </LanguageProvider>
  );
}


