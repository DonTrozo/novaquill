import Link from "next/link";
import { privacyConfiguration } from "@/lib/privacyNotice";
import { requestLocale } from "@/lib/requestLocale";

export default async function PaiaPage() {
  const { organisation: org, missing } = privacyConfiguration();
  const pt = await requestLocale() === "pt";
  const paragraphs = pt ? [
    ["Entidade e contactos", `${org.legalName || "NovaQuill"}${org.registrationNumber ? ` · ${org.registrationNumber}` : ""}. ${org.businessAddress} ${org.informationOfficer ? `Responsável pela informação: ${org.informationOfficer}.` : ""} ${org.privacyEmail}`],
    ["Finalidade e orientação", "Este manual explica os registos e os procedimentos de acesso ao abrigo da secção 51 da PAIA. O guia actual e os formulários oficiais estão disponíveis no sítio do Information Regulator. Pode pedir assistência para formular o seu pedido."],
    ["Registos", "As informações públicas do serviço, preços, termos e aviso de privacidade podem ser consultados sem pedido formal. Os restantes registos incluem dados de conta e autenticação, utilização, documentos e assinaturas guardados, pagamentos, fornecedores, segurança e pedidos de privacidade. Os registos de outros clientes não são públicos."],
    ["Como pedir acesso", "Para acesso, correcção, oposição ou eliminação de dados pessoais, use o formulário gratuito na página de privacidade, sem criar conta, ou o contacto acima. Num pedido formal PAIA, identifique o registo, o direito a exercer ou proteger, a razão pela qual o registo é necessário, a forma de acesso e os seus contactos. Confirmaremos a identidade e autoridade de forma proporcional e comunicaremos a decisão escrita e os motivos de qualquer limitação legal."],
    ["Finalidades, destinatários e protecção", "O tratamento abrange o serviço solicitado, armazenamento opcional de assinaturas, subscrições, segurança e resposta a pedidos. Os destinatários incluem prestadores de alojamento, base de dados, armazenamento, autenticação e pagamento, conforme o aviso de privacidade. Os fornecedores, localizações, contratos e transferências devem constar do inventário verificado. São aplicados controlos de acesso, cifragem e procedimentos de conservação e eliminação; não é afirmada protecção não verificada das cópias de segurança."],
    ["Custos, decisões e reclamações", "O canal de pedidos de privacidade é gratuito. Eventuais taxas de um processo PAIA formal só se aplicam quando legalmente permitidas, com a comunicação e as excepções aplicáveis. As decisões seguem os prazos legais. Pode procurar assistência ou reclamar junto do Information Regulator através dos seus canais oficiais."],
  ] : [
    ["Entity and contacts", `${org.legalName || "NovaQuill"}${org.registrationNumber ? ` · ${org.registrationNumber}` : ""}. ${org.businessAddress} ${org.informationOfficer ? `Information Officer: ${org.informationOfficer}.` : ""} ${org.privacyEmail}`],
    ["Purpose and guide", "This manual explains records and access procedures under section 51 of PAIA. The current guide and prescribed forms are available from the Information Regulator. You can request assistance in preparing a request."],
    ["Records", "Public service descriptions, pricing, terms and privacy information can be read without a formal request. Other records include account/authentication and usage records, stored documents/signatures, payment references, provider records, security events and privacy requests. Other customers' records are not public."],
    ["How to request access", "For personal-information access, correction, objection or deletion, use the free privacy-page form without creating an account, or the contact above. A formal PAIA request should identify the record, the right to exercise or protect, why the record is required, desired access form and contact/authority details. We verify identity proportionately and provide a written decision and reasons for any lawful limitation."],
    ["Purposes, recipients and safeguards", "Processing supports the requested service, optional saved signatures, subscriptions, security and rights requests. Recipients include relevant hosting, database, storage, authentication and payment providers described in the privacy notice. Actual providers, locations, contracts and transfer grounds belong in the verified inventory. Access checks, encryption and retention/deletion procedures apply; no unverified backup protection is claimed."],
    ["Fees, decisions and complaints", "The privacy-request channel is free. Any formal PAIA fees apply only where legally permitted, with appropriate notice/exemptions. Decisions follow applicable statutory timeframes. You can seek assistance or complain through the Information Regulator's official channels."],
  ];
  return <main className="mx-auto max-w-5xl space-y-5 px-6 py-12 text-sm">
    <h1 className="text-2xl font-semibold">{pt ? "Manual PAIA" : "PAIA manual"}</h1>
    {missing.length > 0 && <p role="status">{pt ? "Preparado para revisão; os dados da entidade e a aprovação devem ser preenchidos antes da publicação." : "Prepared for review; entity details and approval must be completed before publication."}</p>}
    {paragraphs.map(([heading, body]) => <section key={heading}><h2 className="mb-1 text-base font-semibold">{heading}</h2><p>{body}</p></section>)}
    <p><Link href="/privacy" className="underline">{pt ? "Aviso e pedidos de privacidade" : "Privacy notice and requests"}</Link></p>
    <p><a href="https://inforegulator.org.za/paia/" className="underline">Information Regulator · PAIA</a></p>
  </main>;
}
