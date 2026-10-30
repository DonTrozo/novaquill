"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { privacyNotice } from "@/lib/privacyNotice";

type Notice = ReturnType<typeof privacyNotice>;
export default function PrivacyNotice({ initialNotice }: { initialNotice?: Notice }) {
  const { t, locale } = useLanguage();
  const [notice, setNotice] = useState<Notice | null>(initialNotice ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (initialNotice) return;
    const controller = new AbortController();
    void fetch("/api/privacy-notice", { signal: controller.signal, cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Notice unavailable");
      return response.json() as Promise<Notice>;
    }).then(setNotice).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [initialNotice]);
  if (failed) return <p role="alert">{t("Could not load the privacy notice. Please try again.")}</p>;
  if (!notice) return <p role="status">{t("Loading privacy notice…")}</p>;
  const org = notice.organisation;
  return <div className="space-y-5 text-sm text-foreground/80">
    <p>{t("Privacy notice version")}: {notice.version}</p>
    {!notice.configured && <p role="status">{t("Company details must be completed before this notice is published. You can still submit a privacy request below.")}</p>}
    {org.legalName && <address className="not-italic">
      <p className="font-medium">{org.legalName}{org.registrationNumber ? ` · ${org.registrationNumber}` : ""}</p>
      <p className="whitespace-pre-line">{org.businessAddress}</p>
      {org.telephone && <p>{org.telephone}</p>}
      <p>{t("Information Officer")}: {org.informationOfficer}</p>
      {org.privacyEmail && <a className="underline" href={`mailto:${org.privacyEmail}`}>{org.privacyEmail}</a>}
    </address>}
    {notice.sections.map((section) => <section key={section.heading}>
      <h2 className="mb-1 text-base font-semibold text-foreground">{locale === "pt" ? section.headingPt : section.heading}</h2>
      <p>{locale === "pt" ? section.bodyPt : section.body}</p>
    </section>)}
    <p><a href="/terms" className="underline">{locale === "pt" ? "Termos de Serviço" : "Terms of Service"}</a>{" · "}<a href="/subscription-policy" className="underline">{locale === "pt" ? "Subscrições e reembolsos" : "Subscriptions and refunds"}</a>{" · "}<a href="/cookies" className="underline">{locale === "pt" ? "Cookies e armazenamento" : "Cookies and storage"}</a></p>
    <p><a href="/paia" className="underline">{locale === "pt" ? "Manual PAIA" : "PAIA manual"}</a></p>
    <p><a href="https://inforegulator.org.za/" className="underline">Information Regulator</a></p>
  </div>;
}
