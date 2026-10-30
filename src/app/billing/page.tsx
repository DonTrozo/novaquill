import Link from "next/link";
import BillingRequestForm from "@/components/BillingRequestForm";
import { requestLocale } from "@/lib/requestLocale";

export default async function BillingPage() {
  const pt = await requestLocale() === "pt";
  return <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
    <h1 className="text-2xl font-semibold">{pt ? "Ajuda com pagamentos e segurança" : "Billing and security help"}</h1>
    <p className="text-sm">{pt ? "Se estiver autenticado e a autorização de pagamento estiver associada à conta, pode cancelar a renovação no painel. Utilize este formulário para subscrições anteriores, cobranças contestadas, reembolsos ou se não conseguir aceder à conta." : "If you are signed in and the payment mandate is linked to your account, you can cancel renewal in the dashboard. Use this form for older subscriptions, disputed charges, refunds or when you cannot access your account."}</p>
    <BillingRequestForm />
    <nav className="flex flex-wrap gap-4 text-sm underline"><Link href="/dashboard">{pt ? "Painel" : "Dashboard"}</Link><Link href="/subscription-policy">{pt ? "Política de subscrições" : "Subscription policy"}</Link><Link href="/privacy">{pt ? "Pedidos de privacidade" : "Privacy requests"}</Link></nav>
  </main>;
}
