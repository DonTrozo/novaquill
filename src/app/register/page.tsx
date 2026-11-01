"use client";

import { useLanguage } from "@/context/LanguageContext";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { track } from "@/lib/track";
import { LEGAL_POLICY_VERSION } from "@/lib/legalVersion";
import { authReturnPath } from "@/lib/authReturn";

export default function RegisterPage() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, acceptTerms, termsVersion: LEGAL_POLICY_VERSION }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Registration failed");
      return;
    }
    track("signup_register");
    const next = authReturnPath(new URLSearchParams(window.location.search).get("next"));
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">{t("Create account")}</h1>
      <form onSubmit={onSubmit} className="grid gap-4">
        <input
          type="text"
          placeholder={t("Name (optional)")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
        />
        <input
          type="email"
          placeholder={t("Email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder={t("Password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
          required
        />
        {error && <div className="text-sm text-red-600">{t(error)}</div>}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-1" />
          <span>{t("I agree to the Terms of Service.")}{" "}<a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">{t("Terms of Service")}</a>{" · "}{LEGAL_POLICY_VERSION}</span>
        </label>
        <button className="rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white">{t("Register")}</button>
        <p className="text-xs text-foreground/65">{t("Account details are used for access, subscriptions and security. Read how we handle your information.")}{" "}<a href="/privacy" className="underline">{t("Privacy Policy")}</a></p>
      </form>
    </div>
  );
}
