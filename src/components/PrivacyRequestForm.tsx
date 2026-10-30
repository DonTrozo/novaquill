"use client";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyRequestForm({ publicChannel = false }: { publicChannel?: boolean }) {
  const { t } = useLanguage();
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [kind, setKind] = useState("CORRECTION");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [error, setError] = useState(false);
  return <form className="mt-4 grid gap-2" onSubmit={async (event) => {
    event.preventDefault(); setSending(true); setError(false); setReceipt(null);
    try {
      const response = await fetch("/api/dsar/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, message, ...(publicChannel ? { contactEmail, website } : {}) }) });
      if (!response.ok) throw new Error("Request failed");
      const payload = await response.json();
      setReceipt(payload.request.id); setMessage("");
    } catch { setError(true); }
    finally { setSending(false); }
  }}>
    <h3 className="text-sm font-medium">{t("Privacy request")}</h3>
    <p className="text-xs text-foreground/70">{t("Request access, correction or deletion of personal information, or object to processing. This channel is free. Do not include passwords or payment card details.")}</p>
    {publicChannel && <>
      <p className="text-xs text-foreground/70">{t("You do not need an account. We will verify your identity before disclosing or changing personal information.")}</p>
      <label className="grid gap-1 text-sm">{t("Contact email for your reply")}
        <input className="rounded border bg-background p-2" type="email" required maxLength={254} autoComplete="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} disabled={sending} />
      </label>
      <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label></div>
    </>}
    <label className="grid gap-1 text-sm">{t("Request type")}
      <select className="rounded border bg-background p-2" value={kind} onChange={(event) => setKind(event.target.value)} disabled={sending}>
        {[["ACCESS", "Access"], ["CORRECTION", "Correction"], ["OBJECTION", "Objection"], ["DELETION", "Deletion"]].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm">{t("Describe your request")}
      <textarea className="rounded border bg-background p-2" required maxLength={4000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} disabled={sending} />
    </label>
    <button type="submit" disabled={sending || !message.trim()} className="justify-self-start rounded border px-3 py-2 text-sm disabled:opacity-50">{sending ? t("Sending…") : t("Submit privacy request")}</button>
    {receipt && <p role="status" className="text-sm">{t("Request recorded. Keep this reference: {reference}", { reference: receipt })}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t("Could not record your request. Please try again.")}</p>}
  </form>;
}
