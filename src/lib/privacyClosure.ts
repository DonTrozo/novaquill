import { privacyConfiguration } from "./privacyNotice";

type Evidence = { reference: string; reviewedBy: string; reviewedAt: string; sha256?: string };
const requirements = [
  { name: "Lawful processing", evidence: ["processing_register_approval", "provider_contract_coverage"] },
  { name: "Data minimisation", evidence: ["legacy_data_review", "provider_inventory"] },
  { name: "Privacy notification", evidence: ["privacy_notice_approval", "paia_manual_approval", "officer_registration"] },
  { name: "Security", evidence: ["backup_restore_test", "live_provider_security_test", "approved_production_release"] },
  { name: "Restricted access", evidence: ["two_account_browser_test", "live_provider_security_test", "approved_production_release"] },
  { name: "Data retention", evidence: ["retention_schedule_approval", "retention_job_run", "backup_restore_test"] },
  { name: "User rights", evidence: ["rights_request_owner_and_exercise", "approved_production_release"] },
  { name: "Breach notification", evidence: ["incident_owner_and_exercise", "officer_registration"] },
  { name: "Third-party processing", evidence: ["provider_inventory", "provider_contract_coverage"] },
  { name: "International transfers", evidence: ["provider_inventory", "international_transfer_assessment", "provider_contract_coverage"] },
];

export function privacyClosure(evidence: Record<string, unknown>, env: Record<string, string | undefined> = process.env) {
  const configuration = privacyConfiguration(env);
  const valid = (name: string) => {
    const item = evidence[name] as Partial<Evidence> | undefined;
    if (!item || typeof item.reference !== "string" || !item.reference.trim() || typeof item.reviewedBy !== "string" || !item.reviewedBy.trim() || typeof item.reviewedAt !== "string") return false;
    const time = Date.parse(item.reviewedAt);
    // A boolean tick, future date or anonymous reviewer is not evidence.
    return Number.isFinite(time) && time <= Date.now() && (!item.sha256 || /^[a-f0-9]{64}$/i.test(item.sha256));
  };
  const technical: Record<string, string[]> = {};
  technical.Security = [];
  if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32) technical.Security.push("strong_auth_secret_configured");
  if (!env.STORAGE_ENCRYPTION_KEY || Buffer.from(env.STORAGE_ENCRYPTION_KEY, "base64").length !== 32) technical.Security.push("storage_key_configured");
  try {
    const database = new URL(env.DATABASE_URL || "");
    if (!["require", "verify-full", "verify-ca"].includes(database.searchParams.get("sslmode") || "")) technical.Security.push("database_tls_configured");
  } catch { technical.Security.push("database_tls_configured"); }
  if (!env.REDIS_URL?.startsWith("rediss://")) technical.Security.push("distributed_rate_limit_tls_configured");
  technical["Data retention"] = [];
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) technical["Data retention"].push("retention_secret_configured");
  for (const key of ["SECURITY_LOG_RETENTION_DAYS", "PRIVACY_REQUEST_RETENTION_DAYS"]) {
    const value = env[key] || "";
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 3650) technical["Data retention"].push(`${key.toLowerCase()}_configured`);
  }
  return requirements.map((requirement) => ({
    name: requirement.name,
    missing: [...(configuration.missing.length ? ["confirmed_organisation_details"] : []), ...requirement.evidence.filter((name) => !valid(name)), ...(technical[requirement.name] || [])],
  })).map((item) => ({ ...item, readyForReview: item.missing.length === 0 }));
}
