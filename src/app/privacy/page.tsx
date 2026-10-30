"use client";

import PrivacyRequestForm from "@/components/PrivacyRequestForm";
import PrivacyNotice from "@/components/PrivacyNotice";
import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyPage() {
  const { t } = useLanguage();
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">{t("Privacy Policy")}</h1>
      <PrivacyNotice />
      <PrivacyRequestForm publicChannel />
    </div>
  );
}



