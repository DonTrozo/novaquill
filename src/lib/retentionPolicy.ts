// Operational limits chosen for this service; these are not statutory POPIA periods.
export function retentionPeriods(env: Record<string, string | undefined> = process.env) {
  const parse = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 3650 ? Number(value) : null;
  return { securityDays: parse(env.SECURITY_LOG_RETENTION_DAYS ?? "90"), requestDays: parse(env.PRIVACY_REQUEST_RETENTION_DAYS ?? "365") };
}
