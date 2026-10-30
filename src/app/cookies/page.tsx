import LegalPolicyPage from "@/components/LegalPolicyPage";
import { browserStorageSections } from "@/lib/legalPolicies";

export default function CookiesPage() {
  return <LegalPolicyPage title="Cookies and browser storage" titlePt="Cookies e armazenamento no navegador" sections={browserStorageSections} />;
}
