import { retentionPeriods } from "@/lib/retentionPolicy";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// Configure an approved retention schedule before enabling the scheduler. Never deletes contracts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return new Response("Maintenance not configured", { status: 503 });
  const provided = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return new Response("Unauthorized", { status: 401 });
  const { securityDays: logDays, requestDays } = retentionPeriods();
  if (!logDays || !requestDays) return new Response("Approved retention periods required", { status: 503 });
  const dryRun = new URL(request.url).searchParams.get("dryRun");
  // Reject typos instead of accidentally treating a preview request as a deletion.
  if (dryRun !== null && dryRun !== "true") return new Response("Use dryRun=true for a preview", { status: 400 });
  const now = Date.now();
  if (dryRun === "true") {
    const [logs, requests, billing] = await prisma.$transaction([
      prisma.securityEvent.count({ where: { retentionHold: false, createdAt: { lt: new Date(now - logDays * 86_400_000) } } }),
      prisma.privacyRequest.count({ where: { retentionHold: false, status: "CLOSED", resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
      prisma.billingRequest.count({ where: { retentionHold: false, status: "CLOSED", resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
    ]);
    return Response.json({ dryRun: true, checkedAt: new Date(now).toISOString(), securityDays: logDays, requestDays, eligibleSecurityEvents: logs, eligibleClosedRequests: requests, eligibleClosedBillingRequests: billing }, { headers: { "Cache-Control": "no-store" } });
  }
  const [logs, requests, billing] = await prisma.$transaction([
    prisma.securityEvent.deleteMany({ where: { retentionHold: false, createdAt: { lt: new Date(now - logDays * 86_400_000) } } }),
    prisma.privacyRequest.deleteMany({ where: { retentionHold: false, status: "CLOSED", resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
    prisma.billingRequest.deleteMany({ where: { retentionHold: false, status: "CLOSED", resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
  ]);
  return Response.json({ deletedSecurityEvents: logs.count, deletedClosedRequests: requests.count, deletedClosedBillingRequests: billing.count });
}
