import LegalPolicyPage from "@/components/LegalPolicyPage";
import { subscriptionSections } from "@/lib/legalPolicies";

export default function SubscriptionPolicyPage() {
  return <LegalPolicyPage title="Subscriptions, cancellation and refunds" titlePt="Subscrições, cancelamento e reembolsos" sections={subscriptionSections} />;
}
