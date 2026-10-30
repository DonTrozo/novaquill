import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

function days(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 3650 ? parsed : null;
}

// Configure an approved retention schedule before enabling the scheduler. Never deletes contracts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return new Response("Maintenance not configured", { status: 503 });
  const provided = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return new Response("Unauthorized", { status: 401 });
  const logDays = days(process.env.SECURITY_LOG_RETENTION_DAYS);
  const requestDays = days(process.env.PRIVACY_REQUEST_RETENTION_DAYS);
  if (!logDays || !requestDays) return new Response("Approved retention periods required", { status: 503 });
  const now = Date.now();
  const [logs, requests] = await prisma.$transaction([
    prisma.securityEvent.deleteMany({ where: { retentionHold: false, createdAt: { lt: new Date(now - logDays * 86_400_000) } } }),
    prisma.privacyRequest.deleteMany({ where: { retentionHold: false, status: "CLOSED", resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
  ]);
  return Response.json({ deletedSecurityEvents: logs.count, deletedClosedRequests: requests.count });
}
