"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PricingPage() {
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
      <h1 className="text-2xl font-semibold mb-2">Pricing</h1>
      <p className="mb-8 max-w-2xl text-foreground/70">
        Start with 3 free documents per month. Upgrade for unlimited signing, cloud document storage and priority support. Annual Pro gives the same features at a lower effective monthly price.
      </p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-foreground/15 p-6">
          <div className="text-xl font-medium">Free</div>
          <div className="text-3xl font-semibold mt-1">€0</div>
          <div className="text-sm text-foreground/60">for occasional signing</div>
          <ul className="mt-3 text-sm text-foreground/80 list-disc list-inside">
            <li>3 completed documents per month</li>
            <li>Text, dates, initials and checkboxes</li>
            <li>Reusable signatures</li>
            <li>Account required for saved signatures</li>
            <li>No branding or watermarks</li>
          </ul>
          <div className="mt-6">
            <Link href="/#upload" className="inline-flex items-center rounded-md px-5 py-3 border border-foreground/20 hover:bg-foreground/5 transition">Try Free</Link>
          </div>
        </div>

        <div className="rounded-lg border border-foreground/15 p-6">
          <div className="text-xl font-medium">Pro Monthly</div>
          <div className="text-3xl font-semibold mt-1">€9<span className="text-base font-normal">/mo</span></div>
          <div className="text-sm text-foreground/60">pay month to month</div>
          {zar && (
            <div className="text-xs text-foreground/60 mt-1">Approx. ZAR {monthlyZar} /mo</div>
          )}
          <ul className="mt-3 text-sm text-foreground/80 list-disc list-inside">
            <li>Unlimited cloud storage</li>
            <li>Unlimited signing</li>
            <li>Priority support</li>
          </ul>
          <div className="mt-6">
            <button 
              onClick={() => handleSubscribe("monthly")}
              className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
            >
              Go Pro Monthly
            </button>
          </div>
        </div>

        <div className="relative rounded-lg border-2 border-[color:var(--color-accent)] p-6">
          <div className="absolute right-4 top-4 rounded-full bg-[color:var(--color-accent)] px-3 py-1 text-xs font-medium text-white">
            Save 17%
          </div>
          <div className="text-xl font-medium">Pro Annual</div>
          <div className="text-3xl font-semibold mt-1">€90<span className="text-base font-normal">/yr</span></div>
          <div className="text-sm text-foreground/60">equivalent to €7.50/month</div>
          {zar && (
            <div className="text-xs text-foreground/60 mt-1">
              Approx. ZAR {annualZar} /yr • ZAR {annualMonthlyEquivalentZar} effective /mo
            </div>
          )}
          <ul className="mt-3 text-sm text-foreground/80 list-disc list-inside">
            <li>Unlimited cloud storage</li>
            <li>Unlimited signing</li>
            <li>Priority support</li>
            <li>Two months free versus monthly billing</li>
          </ul>
          <div className="mt-6">
            <button 
              onClick={() => handleSubscribe("annual")}
              className="inline-flex items-center rounded-md px-5 py-3 bg-[color:var(--color-accent)] text-white hover:opacity-90 transition"
            >
              Go Pro Annual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
