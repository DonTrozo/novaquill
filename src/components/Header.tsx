"use client";

import { useLanguage } from "@/context/LanguageContext";

import Link from "next/link";

export default function Header() {
  const { t } = useLanguage();
  return (
    <header className="max-w-5xl mx-auto px-4 py-3 sm:px-6 sm:py-5 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <svg viewBox="370 350 820 570" aria-hidden="true" className="h-10 w-14 rounded-md bg-white">
          <image href="/novaquill-logo.png" width="1536" height="1536" />
        </svg>
        <span className="text-xl font-semibold">NovaQuill</span>
      </Link>
      <details className="relative z-50">
        <summary className="cursor-pointer rounded-md border border-foreground/15 px-3 py-2 text-sm">{t("Menu")}</summary>
        <nav className="absolute right-0 mt-2 grid min-w-36 gap-1 rounded-lg border border-foreground/15 bg-background p-2 shadow-lg">
          <Link className="rounded px-3 py-2 text-sm hover:bg-foreground/5" href="/pricing">{t("Pricing")}</Link>
          <Link className="rounded px-3 py-2 text-sm hover:bg-foreground/5" href="/dashboard">{t("Dashboard")}</Link>
        </nav>
      </details>
    </header>
  );
}

