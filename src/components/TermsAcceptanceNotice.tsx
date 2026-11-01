"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/context/LanguageContext";
import { LEGAL_POLICY_VERSION } from "@/lib/legalVersion";

// A notice, not a document-editor gate. Never infer agreement from login or continued use.
export default function TermsAcceptanceNotice() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  if (status !== "authenticated" || !userId) return null;
  return <AccountTermsNotice key={userId} />;
}

function AccountTermsNotice() {
  const { t } = useLanguage();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/terms-acceptance", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json();
      if (data.currentVersion !== LEGAL_POLICY_VERSION || typeof data.accepted !== "boolean") throw new Error("Version changed");
      setAccepted(data.accepted);
      setError(false);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [retry]);

  async function accept() {
    setSaving(true);
    setError(false);
    try {
      const response = await fetch("/api/terms-acceptance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptTerms: true, termsVersion: LEGAL_POLICY_VERSION }) });
      if (!response.ok) throw new Error("Unconfirmed");
      const data = await response.json();
      if (data.accepted !== true || data.currentVersion !== LEGAL_POLICY_VERSION) throw new Error("Unconfirmed");
      setAccepted(true);
    } catch { setError(true); }
    finally { setSaving(false); }
  }

  if (accepted === true || (accepted === null && !error)) return null;
  return <aside aria-label={t("Terms of Service")} className="border-b border-foreground/20 bg-background px-6 py-3 text-sm">
    <p>{t("Please review the current Terms of Service. Acceptance is separate from marketing consent.")}{" "}
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">{t("Terms of Service")}</a>{" · "}
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">{t("Privacy Policy")}</a>
    </p>
    {error && <p role="alert">{t("Could not confirm terms acceptance. Please retry or reload the page.")}</p>}
    {accepted === false ? <button type="button" disabled={saving} onClick={accept} className="mt-2 rounded-md border px-3 py-2 disabled:opacity-50">{saving ? t("Saving…") : t("I agree to the Terms of Service.")}</button>
      : <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 underline">{t("Retry")}</button>}
  </aside>;
}
