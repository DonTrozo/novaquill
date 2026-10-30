import Link from "next/link";
import { privacyConfiguration } from "@/lib/privacyNotice";
import { requestLocale } from "@/lib/requestLocale";
import { LEGAL_POLICY_VERSION, type LegalSection } from "@/lib/legalPolicies";

type Props = { title: string; titlePt: string; sections: LegalSection[] };
export default async function LegalPolicyPage({ title, titlePt, sections }: Props) {
  const pt = await requestLocale() === "pt";
  const { organisation: org, missing } = privacyConfiguration();
  return <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
    <header className="space-y-3">
      <h1 className="text-2xl font-semibold">{pt ? titlePt : title}</h1>
      <p className="text-sm text-foreground/65">{pt ? "Versão preparada para revisão" : "Version prepared for review"}: {LEGAL_POLICY_VERSION}</p>
      {missing.length > 0 && <p role="status" className="rounded-md border border-foreground/20 p-3 text-sm">{pt ? "Os dados legais e de contacto do prestador devem ser confirmados antes da publicação. Esta versão não confirma aprovação ou procedimentos operacionais concluídos." : "The provider's legal and contact details must be confirmed before publication. This version does not establish approval or completed operational procedures."}</p>}
      {org.legalName && <address className="space-y-1 text-sm not-italic text-foreground/80">
        <p className="font-medium">{org.legalName}{org.registrationNumber ? ` · ${org.registrationNumber}` : ""}</p>
        <p className="whitespace-pre-line">{org.businessAddress}</p>
        {org.privacyEmail && <p><a className="underline" href={`mailto:${org.privacyEmail}`}>{org.privacyEmail}</a></p>}
      </address>}
      <nav aria-label={pt ? "Documentos legais" : "Legal documents"} className="flex flex-wrap gap-x-5 gap-y-2 text-sm underline">
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
