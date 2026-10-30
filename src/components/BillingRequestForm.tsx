"use client";
import { useState, type FormEvent } from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function BillingRequestForm() {
  const { locale } = useLanguage(); const pt = locale === "pt";
  const [pending, setPending] = useState(false); const [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget; const fields = new FormData(form);
    setPending(true); setResult("");
    try {
      const response = await fetch("/api/billing/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fields.entries())) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.request?.id) throw new Error();
      setResult(`${pt ? "Pedido registado. Conserve a referência" : "Request recorded. Keep this reference"}: ${data.request.id}. ${pt ? "Uma confirmação do pedido não é uma confirmação de cancelamento ou reembolso." : "A request receipt does not confirm cancellation or a refund."}`); form.reset();
    } catch { setResult(pt ? "Não foi possível enviar. Tente novamente." : "Could not submit. Please try again."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="grid max-w-xl gap-4 text-sm">
    <p>{pt ? "Este canal gratuito funciona sem conta. Verificaremos a identidade e a autorização antes de alterar pagamentos. Não envie palavras-passe, dados completos do cartão ou documentos desnecessários." : "This free channel works without an account. We verify identity and authority before changing payments. Do not send passwords, complete card details or unnecessary documents."}</p>
    <label className="grid gap-1">{pt ? "Tipo de pedido" : "Request type"}<select name="kind" className="rounded-md border bg-background p-2"><option value="CANCELLATION">{pt ? "Cancelar renovação" : "Cancel renewal"}</option><option value="REFUND">{pt ? "Pedir reembolso" : "Request refund"}</option><option value="PAYMENT">{pt ? "Problema de pagamento" : "Payment problem"}</option><option value="SECURITY">{pt ? "Problema de segurança" : "Security concern"}</option></select></label>
    <label className="grid gap-1">{pt ? "E-mail para resposta" : "Reply email"}<input name="contactEmail" type="email" autoComplete="email" required maxLength={254} className="rounded-md border bg-background p-2" /></label>
    <label className="grid gap-1">{pt ? "Descrição e referência de pagamento, se disponível" : "Details and payment reference, if available"}<textarea name="message" required maxLength={4000} rows={5} className="rounded-md border bg-background p-2" /></label>
    <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button disabled={pending} className="w-fit rounded-md border px-4 py-2 disabled:opacity-50">{pending ? (pt ? "A enviar…" : "Sending…") : (pt ? "Enviar pedido" : "Submit request")}</button>
    {result && <p role="status">{result}</p>}
  </form>;
}
