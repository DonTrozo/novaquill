import PrivacyRequestForm from "@/components/PrivacyRequestForm";
import PrivacyNotice from "@/components/PrivacyNotice";
import { privacyNotice } from "@/lib/privacyNotice";
import { requestLocale } from "@/lib/requestLocale";

export default async function PrivacyPage() {
  const pt = await requestLocale() === "pt";
  return <main className="mx-auto max-w-5xl space-y-5 px-6 py-12">
    <h1 className="text-2xl font-semibold">{pt ? "Política de Privacidade" : "Privacy Policy"}</h1>
    <PrivacyNotice initialNotice={privacyNotice()} />
    <PrivacyRequestForm publicChannel />
  </main>;
}
