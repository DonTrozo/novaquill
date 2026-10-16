"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">{t("Privacy Policy")}</h1>
      <p className="text-sm text-foreground/80">{t("We collect the minimum necessary data. No PII is used for analytics. You control your documents and can export/delete your account at any time from the dashboard or via the DSAR endpoints.")}</p>
    </div>
  );
}



