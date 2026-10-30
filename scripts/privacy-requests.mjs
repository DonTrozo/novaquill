// Run only in an authorised operations environment. Never expose this as a public route.
// This tool does not send email or make a legal decision for the operator.
import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { encryptBuffer, decryptBuffer } from '../src/lib/crypto.ts';

const [command, ...args] = process.argv.slice(2);
const arg = (key) => { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : undefined; };
const prisma = new PrismaClient();
try {
  if (command === 'list') {
    const requests = await prisma.privacyRequest.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 100, select: { id: true, kind: true, createdAt: true } });
    console.log(JSON.stringify(requests, null, 2));
  } else if (command === 'holds') {
    const [requests, events] = await Promise.all([prisma.privacyRequest.findMany({ where: { retentionHold: true }, select: { id: true, kind: true, createdAt: true } }), prisma.securityEvent.findMany({ where: { retentionHold: true }, select: { id: true, action: true, createdAt: true } })]);
    console.log(JSON.stringify({ requests, events }, null, 2));
  } else if ((command === 'hold' || command === 'release-hold') && arg('--id') && arg('--resource') && arg('--case-reference')) {
    const resource = arg('--resource');
    const reference = arg('--case-reference');
    if (!['request', 'event'].includes(resource) || !reference.trim() || reference.length > 128 || !process.env.PRIVACY_OPERATOR_REFERENCE) throw new Error('Verified operator and case reference required');
    await prisma.$transaction(async (tx) => {
      if (resource === 'request') await tx.privacyRequest.update({ where: { id: arg('--id') }, data: { retentionHold: command === 'hold' } });
      else await tx.securityEvent.update({ where: { id: arg('--id') }, data: { retentionHold: command === 'hold' } });
      // Keep the reason and operator identity in the restricted case record, not in public logs.
      await tx.securityEvent.create({ data: { action: command === 'hold' ? 'privacy.hold' : 'privacy.hold.released', targetId: arg('--id') } });
    });
    console.log('Retention hold updated. Preserve the reason/operator reference in the restricted case record.');
  } else if (command === 'read' && arg('--id')) {
    const item = await prisma.privacyRequest.findUniqueOrThrow({ where: { id: arg('--id') }, include: { user: { select: { email: true, name: true } } } });
    console.log(JSON.stringify({ id: item.id, kind: item.kind, status: item.status, createdAt: item.createdAt, user: item.user, contactEmail: item.encryptedContact ? decryptBuffer(Buffer.from(item.encryptedContact), true).toString('utf8') : null, message: decryptBuffer(Buffer.from(item.encryptedMessage), true).toString('utf8') }, null, 2));
  } else if (command === 'close' && arg('--id') && arg('--outcome-file') && arg('--notification-reference') && arg('--notified-at')) {
    if (!process.env.PRIVACY_OPERATOR_REFERENCE) throw new Error('Verified operator reference required');
    const notifiedAt = new Date(arg('--notified-at'));
    const reference = arg('--notification-reference');
    if (Number.isNaN(notifiedAt.valueOf()) || notifiedAt > new Date() || reference.length > 256) throw new Error('Invalid notification evidence');
    const outcome = await readFile(arg('--outcome-file'), 'utf8');
    if (!outcome.trim() || Buffer.byteLength(outcome) > 16_384) throw new Error('Outcome must contain 1 to 16384 bytes');
    await prisma.$transaction(async (tx) => {
      const item = await tx.privacyRequest.findUniqueOrThrow({ where: { id: arg('--id') } });
      if (item.status !== 'OPEN' || notifiedAt < item.createdAt) throw new Error('Request is closed or notification predates it');
      await tx.privacyRequest.update({ where: { id: item.id }, data: { status: 'CLOSED', resolvedAt: new Date(), notifiedAt, encryptedOutcome: encryptBuffer(Buffer.from(JSON.stringify({ outcome, notificationReference: reference, operatorReference: process.env.PRIVACY_OPERATOR_REFERENCE }))) } });
      await tx.securityEvent.create({ data: { actorId: item.userId, action: 'privacy.resolved', targetId: item.id } });
    });
    console.log('Request closed; encrypted outcome and notification evidence recorded.');
  } else {
    throw new Error('Usage: list | holds | hold/release-hold --resource request/event --id ID --case-reference REFERENCE | read --id ID | close --id ID --outcome-file FILE --notification-reference REFERENCE --notified-at ISO-TIMESTAMP');
  }
} catch {
  // Database exceptions may contain connection strings or request data. Do not print them.
  console.error('Privacy operation failed. Check the command, authorised access and request state. No notification was sent.');
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
