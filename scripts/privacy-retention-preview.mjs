// Read-only preflight in an authorised operations environment. Never activates cron or deletes rows.
import { PrismaClient } from '@prisma/client';
import { retentionPeriods } from '../src/lib/retentionPolicy.ts';

const prisma = new PrismaClient();
try {
  const { securityDays, requestDays } = retentionPeriods();
  if (!securityDays || !requestDays) throw new Error('Invalid retention periods');
  const now = Date.now();
  const [events, requests, billing, heldEvents, heldRequests, heldBilling] = await prisma.$transaction([
    prisma.securityEvent.count({ where: { retentionHold: false, createdAt: { lt: new Date(now - securityDays * 86_400_000) } } }),
    prisma.privacyRequest.count({ where: { retentionHold: false, status: 'CLOSED', resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
    prisma.billingRequest.count({ where: { retentionHold: false, status: 'CLOSED', resolvedAt: { lt: new Date(now - requestDays * 86_400_000) } } }),
    prisma.securityEvent.count({ where: { retentionHold: true } }),
    prisma.privacyRequest.count({ where: { retentionHold: true } }),
    prisma.billingRequest.count({ where: { retentionHold: true } }),
  ]);
  console.log(JSON.stringify({ dryRun: true, checkedAt: new Date(now).toISOString(), securityDays, requestDays,
    eligible: { securityEvents: events, closedPrivacyRequests: requests, closedBillingRequests: billing },
    held: { securityEvents: heldEvents, privacyRequests: heldRequests, billingRequests: heldBilling },
    note: 'Counts only. No records deleted; no scheduler configured. Counts can change before execution. Review holds and the approved schedule before activation.' }, null, 2));
} catch {
  console.error('Retention preview failed. Check authorised database access, migrations and retention periods. No records were deleted.');
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
