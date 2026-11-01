import Link from "next/link";
import { privacyConfiguration } from "@/lib/privacyNotice";
import { requestLocale } from "@/lib/requestLocale";
import { type LegalSection } from "@/lib/legalPolicies";
import { LEGAL_POLICY_DATE, LEGAL_POLICY_VERSION } from "@/lib/legalVersion";

type Props = { title: string; titlePt: string; sections: LegalSection[] };
export default async function LegalPolicyPage({ title, titlePt, sections }: Props) {
  const pt = await requestLocale() === "pt";
  const { organisation: org, missing } = privacyConfiguration();
  return <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
    <header className="space-y-3">
      <h1 className="text-2xl font-semibold">{pt ? titlePt : title}</h1>
      <p className="text-sm text-foreground/65">{pt ? "Última actualização" : "Last updated"}: {LEGAL_POLICY_DATE} · {LEGAL_POLICY_VERSION}</p>
      <a className="text-sm underline" href={`/legal/${LEGAL_POLICY_VERSION}.html`}>{pt ? "Guardar esta versão dos termos e políticas" : "Save this version of the terms and policies"}</a>
      {missing.length > 0 && <p role="status" className="rounded-md border border-foreground/20 p-3 text-sm">{pt ? "Os dados do responsável pela informação ainda precisam de confirmação. Os dados empresariais não constituem prova de registo ou de aprovação completa de conformidade." : "Information Officer details still need confirmation. Corporate particulars are not evidence of officer registration or complete compliance sign-off."}</p>}
      {org.legalName && <address className="space-y-1 text-sm not-italic text-foreground/80">
        <p>{pt ? "NovaQuill — um produto da Artobyte" : "NovaQuill — an Artobyte product"}</p>
        <p className="font-medium">{org.legalName}{org.registrationNumber ? ` · ${org.registrationNumber}` : ""}</p>
        <p>{pt ? "Sociedade privada" : "Private company"}</p>
        <p className="text-foreground/65">{pt ? "Sede registada / endereço para notificações" : "Registered office / address for notices"}</p>
        <p className="whitespace-pre-line">{org.businessAddress}</p>
        {org.telephone && <p>{org.telephone}</p>}
        {org.placeOfRegistration && <p>{pt ? "Local de registo" : "Place of registration"}: {org.placeOfRegistration}</p>}
        {org.officeBearers && <p>{pt ? "Representantes legais" : "Office bearers"}: {org.officeBearers}</p>}
        {org.privacyEmail && <p><a className="underline" href={`mailto:${org.privacyEmail}`}>{org.privacyEmail}</a></p>}
      </address>}
      <nav aria-label={pt ? "Documentos legais" : "Legal documents"} className="flex flex-wrap gap-x-5 gap-y-2 text-sm underline">
        <Link href="/billing">{pt ? "Apoio" : "Help"}</Link>
        <Link href="/terms">{pt ? "Termos" : "Terms"}</Link>
        <Link href="/privacy">{pt ? "Privacidade" : "Privacy"}</Link>
        <Link href="/subscription-policy">{pt ? "Subscrições e reembolsos" : "Subscriptions and refunds"}</Link>
        <Link href="/cookies">{pt ? "Cookies e armazenamento" : "Cookies and storage"}</Link>
        <Link href="/paia">{pt ? "Manual PAIA" : "PAIA manual"}</Link>
      </nav>
    </header>
    {sections.map((section) => <section key={section.id} id={section.id} className="space-y-2">
      <h2 className="text-lg font-semibold">{pt ? section.headingPt : section.heading}</h2>
      <p className="text-sm leading-7 text-foreground/80">{pt ? section.bodyPt : section.body}</p>
    </section>)}
  </main>;
}
