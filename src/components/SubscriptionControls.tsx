"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
type State = { pro: boolean; paidThrough: string | null; cancelledAt: string | null; canCancel: boolean; needsBillingHelp: boolean };

export default function SubscriptionControls() {
  const { locale } = useLanguage(); const pt = locale === "pt";
  const [state, setState] = useState<State | null>(null); const [error, setError] = useState(false); const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/subscription", { signal: controller.signal, cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); setState(await r.json()); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  async function cancel() {
    if (pending || !confirm(pt ? "Cancelar os próximos pagamentos? O acesso já pago será mantido até ao fim do período." : "Stop future payments? Your already-paid access continues until the end of its period.")) return;
    setPending(true); setError(false);
    try {
      const response = await fetch("/api/subscription/cancel", { method: "POST" });
      const result = await response.json(); if (!response.ok) throw new Error();
      setState((previous) => previous ? { ...previous, cancelledAt: result.cancelledAt, paidThrough: result.paidThrough, canCancel: false, needsBillingHelp: false } : previous);
    } catch { setError(true); }
    finally { setPending(false); }
  }
  return <div className="mb-4 space-y-2 text-sm">
    {state?.paidThrough && <p>{pt ? "Acesso pago até" : "Paid access through"}: {new Date(state.paidThrough).toLocaleString(locale)}</p>}
    {state?.cancelledAt && <p role="status">{pt ? "Renovação cancelada. O período já pago mantém-se." : "Renewal cancelled. Your already-paid period is preserved."}</p>}
    {state?.canCancel && <button disabled={pending} onClick={cancel} className="rounded-md border px-3 py-2 disabled:opacity-50">{pending ? (pt ? "A cancelar…" : "Cancelling…") : (pt ? "Cancelar renovação" : "Cancel renewal")}</button>}
    {state?.needsBillingHelp && <p>{pt ? "Esta subscrição anterior precisa de confirmação no prestador. Envie um pedido pelo formulário abaixo; a recepção não confirma o cancelamento." : "This older subscription needs provider reconciliation. Submit a request through billing help; a receipt does not confirm cancellation."}</p>}
    {error && <p role="alert">{pt ? "Não foi possível confirmar a operação. Tente novamente ou envie um pedido de apoio." : "Could not confirm the operation. Try again or submit a help request."}</p>}
    <Link href="/billing" className="inline-block underline">{pt ? "Ajuda, cancelamento ou reembolso" : "Billing help, cancellation or refund"}</Link>
  </div>;
}
