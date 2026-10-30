import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers/loadSource.mjs';
const retention = await loadSource(new URL('../src/lib/retentionPolicy.ts', import.meta.url));
const notice = await loadSource(new URL('../src/lib/privacyNotice.ts', import.meta.url), { './retentionPolicy': retention });
const { privacyClosure } = await loadSource(new URL('../src/lib/privacyClosure.ts', import.meta.url), { './privacyNotice': notice });
const env = { PRIVACY_LEGAL_NAME: 'Fixture Company', PRIVACY_ENTITY_TYPE: 'company', PRIVACY_REGISTRATION_NUMBER: 'TEST-ONLY', PRIVACY_BUSINESS_ADDRESS: 'Fixture address', PRIVACY_CONTACT_EMAIL: 'privacy@example.test', PRIVACY_INFORMATION_OFFICER: 'Fixture Officer', PRIVACY_CONTACT_PHONE: 'TEST-PHONE', PRIVACY_PLACE_OF_REGISTRATION: 'TEST-PLACE', PRIVACY_OFFICE_BEARERS: 'TEST-OFFICER', NEXTAUTH_SECRET: 'x'.repeat(32), STORAGE_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'), DATABASE_URL: 'postgresql://fixture:fixture@localhost/fixture?sslmode=require', REDIS_URL: 'rediss://fixture@localhost', CRON_SECRET: 'y'.repeat(32), SECURITY_LOG_RETENTION_DAYS: '90', PRIVACY_REQUEST_RETENTION_DAYS: '365' };

test('public privacy configuration exposes only the explicit public company fields', () => {
  const response = notice.privacyNotice({ ...env, DATABASE_URL: 'NEVER-EXPOSE', STORAGE_ENCRYPTION_KEY: 'NEVER-EXPOSE', PRIVACY_IO_REGISTRATION_REFERENCE: 'PRIVATE-EVIDENCE' });
  assert.equal(response.configured, true); assert.equal(response.organisation.legalName, 'Fixture Company');
  assert.equal(JSON.stringify(response).includes('NEVER-EXPOSE'), false); assert.equal(JSON.stringify(response).includes('PRIVATE-EVIDENCE'), false);
  assert.equal(response.sections.length, 10);
  assert.equal(notice.privacyNotice({}).configured, false);
});

test('an evidence checklist cannot close requirements from code completion or boolean ticks', () => {
  const empty = privacyClosure({}, env); assert.equal(empty.length, 10); assert.ok(empty.every((item) => !item.readyForReview));
  const keys = [...new Set(empty.flatMap((item) => item.missing))];
  assert.ok(privacyClosure(Object.fromEntries(keys.map((key) => [key, true])), env).every((item) => !item.readyForReview));
  const future = { reference: 'example', reviewedBy: 'Officer', reviewedAt: '2999-01-01T00:00:00Z' };
  assert.ok(privacyClosure(Object.fromEntries(keys.map((key) => [key, future])), env).every((item) => !item.readyForReview));
});

test('evidence completeness requires confirmed company details and named dated references', () => {
  const keys = [...new Set(privacyClosure({}, env).flatMap((item) => item.missing))];
  const evidence = Object.fromEntries(keys.map((key) => [key, { reference: `restricted-evidence:${key}`, reviewedBy: 'Fixture Officer', reviewedAt: '2026-10-01T12:00:00Z' }]));
  assert.ok(privacyClosure(evidence, env).every((item) => item.readyForReview));
  assert.ok(privacyClosure(evidence, {}).every((item) => !item.readyForReview));
  evidence.provider_contract_coverage.sha256 = 'not-a-document-hash';
  assert.equal(privacyClosure(evidence, env).find((item) => item.name === 'Third-party processing').readyForReview, false);
});
