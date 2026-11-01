import { termsSections, subscriptionSections } from "./legalPolicies";
import { LEGAL_POLICY_VERSION } from "./legalVersion";
import { privacyConfiguration } from "./privacyNotice";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function checkoutReview(amount: string, plan: "monthly" | "annual", locale: "en" | "pt") {
  const pt = locale === "pt";
  const org = privacyConfiguration().organisation;
  const period = pt ? (plan === "annual" ? "ano" : "mês") : (plan === "annual" ? "year" : "month");
  const sections = [...subscriptionSections, ...termsSections].map(section => `<section><h3>${escape(pt ? section.headingPt : section.heading)}</h3><p>${escape(pt ? section.bodyPt : section.body)}</p></section>`).join("");
  return {
    locale,
    title: pt ? "Rever a subscrição NovaQuill" : "Review your NovaQuill subscription",
    acceptLabel: pt ? "Li e aceito os termos de compra, cancelamento e reembolso apresentados acima e autorizo o valor e a periodicidade recorrentes indicados." : "I have read and accept the purchase, cancellation and refund terms displayed above and authorise the stated recurring amount and interval.",
    buttonLabel: pt ? "Continuar para PayFast" : "Continue to PayFast",
    html: `<p><strong>${escape(org.legalName)} · ${escape(org.registrationNumber)}</strong><br>${escape(org.businessAddress)}<br>${escape(org.privacyEmail)} · ${escape(org.telephone)}</p><h2>${pt ? "Valor recorrente" : "Recurring amount"}: ZAR ${escape(amount)} / ${period}</h2><p>${pt ? "Cobrado até ao cancelamento; o valor anual é cobrado de uma vez, não em prestações mensais. Confira os termos abaixo antes de continuar." : "Charged until cancellation; an annual amount is charged in full, not as monthly instalments. Review the terms below before continuing."}</p><p>${pt ? "Versão" : "Version"}: ${LEGAL_POLICY_VERSION}</p>${sections}<p><a href="/privacy">${pt ? "Aviso de privacidade" : "Privacy notice"}</a> · <a href="/pricing">${pt ? "Voltar aos preços" : "Back to pricing"}</a></p>`,
  };
}
