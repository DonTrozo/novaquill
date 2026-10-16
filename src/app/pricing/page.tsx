"use client";

import { useLanguage } from "@/context/LanguageContext";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const { t } = useLanguage();
  const [zar, setZar] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/rates").then((r) => r.json()).then((d) => setZar(d?.EUR_ZAR ?? null)).catch(() => setZar(null));
  }, []);
  const monthlyZar = zar ? (9 * zar).toFixed(2) : null;
  const annualZar = zar ? (90 * zar).toFixed(2) : null;
  const annualMonthlyEquivalentZar = zar ? (7.5 * zar).toFixed(2) : null;
  
  const handleSubscribe = (plan: "monthly" | "annual") => {
    // Redirect to subscription endpoint
    window.location.href = `/api/subscribe/${plan}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-2">{t("Pricing")}</h1>
      <p className="mb-8 max-w-2xl text-foreground/70">{t("Start with 3 free documents per month. Upgrade for unlimited signing, cloud document storage and priority support. Annual Pro gives the same features at a lower effective monthly price.")}</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-foreground/15 p-6">
          <div className="text-xl font-medium">{t("Free")}</div>
          <div className="text-3xl font-semibold mt-1">€0</div>
          <div className="text-sm text-foreground/60">{t("for occasional signing")}</div>
          <ul className="mt-3 text-sm text-foreground/80 list-disc list-inside">
            <li>{t("3 completed documents per month")}</li>
            <li>{t("Text, dates, initials and checkboxes")}</li>
            <li>{t("Reusable signatures")}</li>
            <li>{t("Account required for saved signatures")}</li>
            <li>{t("No branding or watermarks")}</li>
          </ul>
          <div className="mt-6">
            <Link href="/#upload" className="inline-flex items-center rounded-md px-5 py-3 border border-foreground/20 hover:bg-foreground/5 transition">{t("Try Free")}</Link>
          </div>
        </div>

        <div className="rounded-lg border border-foreground/15 p-6">
          <div className="text-xl font-medium">{t("Pro Monthly")}</div>
          <div className="text-3xl font-semibold mt-1">€9<span className="text-base font-normal">{t("/mo")}</span></div>
          <div className="text-sm text-foreground/60">{t("pay month to month")}</div>
          {zar && (
            <div className="text-xs text-foreground/60 mt-1">{t("Approx. ZAR")}{" "}{monthlyZar}{" "}{t("/mo")}</div>
          )}
          <ul className="mt-3 text-sm text-foreground/80 list-disc list-inside">
            <li>{t("Unlimited cloud storage")}</li>
            <li>{t("Unlimited signing")}</li>
            <li>{t("Priority support")}</li>
          </ul>
          <div className="mt-6">
            <button 
              onClick={() => handleSubscribe("monthly")}
              className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
            >{t("Go Pro Monthly")}</button>
          </div>
        </div>

        <div className="relative rounded-lg border-2 border-[color:var(--color-accent)] p-6">
          <div className="absolute right-4 top-4 rounded-full bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium text-white">{t("Save 17%")}</div>
          <div className="text-xl font-medium">{t("Pro Annual")}</div>
          <div className="text-3xl font-semibold mt-1">€90<span className="text-base font-normal">{t("/yr")}</span></div>
          <div className="text-sm text-foreground/60">{t("equivalent to €7.50/month")}</div>
          {zar && (
            <div className="text-xs text-foreground/60 mt-1">{t("Approx. ZAR")}{" "}{annualZar}{" "}{t("/yr • ZAR")}{" "}{annualMonthlyEquivalentZar}{" "}{t("effective /mo")}</div>
          )}
          <ul className="mt-3 text-sm text-foreground/80 list-disc list-inside">
            <li>{t("Unlimited cloud storage")}</li>
            <li>{t("Unlimited signing")}</li>
            <li>{t("Priority support")}</li>
            <li>{t("Two months free versus monthly billing")}</li>
          </ul>
          <div className="mt-6">
            <button 
              onClick={() => handleSubscribe("annual")}
              className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
            >{t("Go Pro Annual")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
