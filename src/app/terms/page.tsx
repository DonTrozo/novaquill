"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function TermsPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">{t("Terms of Service")}</h1>
      <p className="text-sm text-foreground/80">{t("By using NovaQuill, you agree to our simple rules: keep content lawful, respect privacy, and understand that electronic signatures here are Simple Electronic Signatures. Upgrading to Advanced/Qualified signatures requires a certified Trust Service Provider.")}</p>
    </div>
  );
}







