import test from 'node:test';
import assert from 'node:assert/strict';
import { FREE_DOCUMENT_LIMIT, remainingDocuments, reserveDocumentCredit, usageMonth } from '../src/lib/signingQuota.ts';

function store(initial) {
  let user = initial;
  return {
    read: async () => user ? { ...user } : null,
    compareAndSet: async (previous, month, used) => {
      if (!user || user.subscription !== previous.subscription || user.usageYearMonth !== previous.usageYearMonth || user.docsUsedThisMonth !== previous.docsUsedThisMonth) return false;
      user = { ...user, usageYearMonth: month, docsUsedThisMonth: used };
      return true;
    },
    current: () => user,
  };
}

test('free users receive exactly three documents per month', async () => {
  const database = store({ subscription: 'FREE', usageYearMonth: null, docsUsedThisMonth: 0 });
  for (let i = 1; i <= FREE_DOCUMENT_LIMIT; i++) {
    const result = await reserveDocumentCredit(database, 202610);
    assert.equal(result.status, 200); assert.equal(result.used, i); assert.equal(result.remaining, 3-i);
  }
  assert.equal((await reserveDocumentCredit(database, 202610)).status, 402);
  assert.equal(database.current().docsUsedThisMonth, 3);
});

test('simultaneous tabs cannot consume more than the last free credit', async () => {
  const database = store({ subscription: 'FREE', usageYearMonth: 202610, docsUsedThisMonth: 2 });
  const results = await Promise.all(Array.from({ length: 6 }, () => reserveDocumentCredit(database, 202610)));
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.equal(results.filter((result) => result.status === 402).length, 5);
  assert.equal(database.current().docsUsedThisMonth, 3);
});

test('a new month renews the allowance and concurrent requests do not reset each other', async () => {
  const database = store({ subscription: 'FREE', usageYearMonth: 202609, docsUsedThisMonth: 3 });
  assert.equal(remainingDocuments(database.current(), 202610), 3);
  const results = await Promise.all(Array.from({ length: 4 }, () => reserveDocumentCredit(database, 202610)));
  assert.equal(results.filter((result) => result.status === 200).length, 3);
  assert.equal(database.current().usageYearMonth, 202610);
  assert.equal(database.current().docsUsedThisMonth, 3);
});

test('Pro has no monthly document cutoff', async () => {
  const database = store({ subscription: 'PRO', usageYearMonth: 202610, docsUsedThisMonth: 100 });
  assert.equal(remainingDocuments(database.current(), 202610), null);
  const result = await reserveDocumentCredit(database, 202610);
  assert.equal(result.status, 200); assert.equal(result.remaining, null); assert.equal(result.used, 101);
});

test('an unavailable account or unresolved contention does not allocate credit', async () => {
  assert.equal((await reserveDocumentCredit(store(null), 202610)).status, 404);
  const conflicting = store({ subscription: 'FREE', usageYearMonth: 202610, docsUsedThisMonth: 0 });
  conflicting.compareAndSet = async () => false;
  assert.equal((await reserveDocumentCredit(conflicting, 202610)).status, 409);
  assert.equal(conflicting.current().docsUsedThisMonth, 0);
});

test('month keys are consistent at UTC month boundaries', () => {
  assert.equal(usageMonth(new Date('2026-09-30T23:59:59Z')), 202609);
  assert.equal(usageMonth(new Date('2026-10-01T00:00:00Z')), 202610);
});
