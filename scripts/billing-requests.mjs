// Restricted operations only. This command sends no emails and cannot pretend to cancel a provider mandate.
import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { encryptBuffer, decryptBuffer } from '../src/lib/crypto.ts';
const prisma = new PrismaClient();
const [command, ...args] = process.argv.slice(2);
const arg = (key) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
try {
  if (!process.env.PRIVACY_OPERATOR_REFERENCE) throw new Error();
  if (command === 'list') {
    console.log(JSON.stringify(await prisma.billingRequest.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 100, select: { id: true, kind: true, createdAt: true, userId: true } }), null, 2));
  } else if (command === 'read' && arg('--id')) {
    const item = await prisma.billingRequest.findUniqueOrThrow({ where: { id: arg('--id') } });
    console.log(JSON.stringify({ id: item.id, userId: item.userId, kind: item.kind, contact: decryptBuffer(Buffer.from(item.encryptedContact), true).toString('utf8'), message: decryptBuffer(Buffer.from(item.encryptedMessage), true).toString('utf8') }, null, 2));
  } else if (command === 'close' && arg('--id') && arg('--outcome-file') && arg('--notification-reference') && arg('--notified-at')) {
    const notifiedAt = new Date(arg('--notified-at')); const reference = arg('--notification-reference');
    if (!Number.isFinite(notifiedAt.valueOf()) || notifiedAt > new Date() || !reference.trim() || reference.length > 256) throw new Error();
    const outcome = await readFile(arg('--outcome-file'), 'utf8'); if (!outcome.trim() || Buffer.byteLength(outcome) > 16384) throw new Error();
    await prisma.$transaction(async tx => {
      const item = await tx.billingRequest.findUniqueOrThrow({ where: { id: arg('--id') } });
      if (item.status !== 'OPEN' || notifiedAt < item.createdAt) throw new Error();
      // Legacy cancellation may be reconciled only after actual provider confirmation and identity verification.
      if (arg('--cancelled-user')) {
        if (item.kind !== 'CANCELLATION' || (item.userId && item.userId !== arg('--cancelled-user')) || !arg('--provider-reference') || !arg('--identity-reference')) throw new Error();
        await tx.user.update({ where: { id: arg('--cancelled-user') }, data: { subscriptionCancelledAt: new Date() } });
      }
      await tx.billingRequest.update({ where: { id: item.id }, data: { userId: arg('--cancelled-user') || item.userId, status: 'CLOSED', resolvedAt: new Date(), notifiedAt, encryptedOutcome: encryptBuffer(Buffer.from(JSON.stringify({ outcome, notificationReference: reference, providerReference: arg('--provider-reference') || null, identityReference: arg('--identity-reference') || null, verifiedUser: arg('--cancelled-user') || item.userId, operatorReference: process.env.PRIVACY_OPERATOR_REFERENCE }))) } });
      await tx.securityEvent.create({ data: { actorId: item.userId, action: 'billing.resolved', targetId: item.id } });
    });
    console.log('Written outcome and notification reference recorded. No message or provider request was sent.');
  } else throw new Error();
} catch { console.error('Billing operation failed. Verify authorised access, command arguments and actual evidence.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
