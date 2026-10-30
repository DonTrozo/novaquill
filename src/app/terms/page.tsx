import LegalPolicyPage from "@/components/LegalPolicyPage";
import { termsSections } from "@/lib/legalPolicies";

export default function TermsPage() {
  return <LegalPolicyPage title="Terms of Service" titlePt="Termos de Serviço" sections={termsSections} />;
}
