import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// A real PostgreSQL engine compiled to WASM, in memory; never reads a connection URL.
const db = new PGlite();
const migration = (name) => readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
test.after(async () => db.close());

await db.exec(await migration('20260328175404_init'));
await db.exec(await migration('20260329143000_add_saved_signature'));
await db.query('INSERT INTO "User" (id, email, "updatedAt") VALUES ($1,$2,NOW()),($3,$4,NOW())', ['owner-a', 'a@example.test', 'owner-b', 'b@example.test']);
await db.query('INSERT INTO "Document" (id,"userId",filename,"mimeType",size,path) VALUES ($1,$2,$3,$4,$5,$6)', ['existing-pdf','owner-a','existing.pdf','application/pdf',9,'encrypted-object']);

// Exercise the exact SQL that will be deployed, against pre-existing data.
await db.exec(await migration('20261022190000_add_privacy_safeguards'));
await db.exec(await migration('20261022193000_public_privacy_requests_and_holds'));
await db.exec(await migration('20261030170000_billing_cancellation'));

test('the additive migration preserves existing users and documents', async () => {
  assert.equal((await db.query('SELECT * FROM "User"')).rows.length, 2);
  const doc = (await db.query('SELECT * FROM "Document" WHERE id=$1', ['existing-pdf'])).rows[0];
  assert.equal(doc.path, 'encrypted-object'); assert.equal(doc.filename, 'existing.pdf');
});

test('the database enforces signature account ownership, uniqueness and encrypted byte storage', async () => {
  const bytes = new Uint8Array([78,71,49,1,2,3]);
  const insert = 'INSERT INTO "SavedSignature" (id,"userId",name,"mimeType","encryptedPayload",hash,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())';
  await db.query(insert, ['sig-a','owner-a','Signature','image/png',bytes,'same-hash']);
  await db.query(insert, ['sig-b','owner-b','Signature','image/png',bytes,'same-hash']);
  await assert.rejects(db.query(insert, ['sig-duplicate','owner-a','Signature','image/png',bytes,'same-hash']));
  await assert.rejects(db.query(insert, ['sig-orphan','missing-account','Signature','image/png',bytes,'other-hash']));
  const own = (await db.query('SELECT id,"encryptedPayload" FROM "SavedSignature" WHERE "userId"=$1', ['owner-a'])).rows;
  assert.deepEqual(own.map((row) => row.id), ['sig-a']); assert.deepEqual(new Uint8Array(own[0].encryptedPayload), bytes);
});

test('the public rights channel can retain an encrypted request without creating an account', async () => {
  await db.query('INSERT INTO "PrivacyRequest" (id,kind,"encryptedMessage","encryptedContact") VALUES ($1,$2,$3,$4)', ['public-request','ACCESS',new Uint8Array([1,2]),new Uint8Array([3,4])]);
  const item = (await db.query('SELECT * FROM "PrivacyRequest" WHERE id=$1', ['public-request'])).rows[0];
  assert.equal(item.userId, null); assert.equal(item.status, 'OPEN'); assert.equal(item.retentionHold, false);
});

test('a failed account-delete transaction rolls back account metadata and permits retry', async () => {
  await db.query('BEGIN');
  await db.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', ['owner-a']);
  await db.query('DELETE FROM "User" WHERE id=$1', ['owner-a']);
  await db.query('ROLLBACK');
  assert.equal((await db.query('SELECT id FROM "User" WHERE id=$1', ['owner-a'])).rows.length, 1);
  assert.equal((await db.query('SELECT id FROM "Document" WHERE id=$1', ['existing-pdf'])).rows.length, 1);
});

test('retention preserves open requests and records under a hold', async () => {
  await db.exec(`INSERT INTO "SecurityEvent" (id,action,"createdAt","retentionHold") VALUES ('old-log','document.read',NOW()-INTERVAL '200 days',false),('held-log','document.read',NOW()-INTERVAL '200 days',true);
INSERT INTO "PrivacyRequest" (id,kind,"encryptedMessage",status,"resolvedAt","retentionHold") VALUES ('old-closed','ACCESS','\\x01','CLOSED',NOW()-INTERVAL '500 days',false),('old-held','ACCESS','\\x01','CLOSED',NOW()-INTERVAL '500 days',true);`);
  await db.query('DELETE FROM "SecurityEvent" WHERE "retentionHold"=false AND "createdAt"<$1', [new Date(Date.now()-90*86400000)]);
  await db.query('DELETE FROM "PrivacyRequest" WHERE "retentionHold"=false AND status=$1 AND "resolvedAt"<$2', ['CLOSED',new Date(Date.now()-365*86400000)]);
  assert.equal((await db.query('SELECT id FROM "SecurityEvent" WHERE id=$1', ['old-log'])).rows.length, 0);
  assert.equal((await db.query('SELECT id FROM "SecurityEvent" WHERE id=$1', ['held-log'])).rows.length, 1);
  assert.equal((await db.query('SELECT id FROM "PrivacyRequest" WHERE id=$1', ['old-closed'])).rows.length, 0);
  assert.equal((await db.query('SELECT id FROM "PrivacyRequest" WHERE id=$1', ['old-held'])).rows.length, 1);
  assert.equal((await db.query('SELECT id FROM "PrivacyRequest" WHERE id=$1', ['public-request'])).rows.length, 1);
});

test('billing migration protects mandate uniqueness and permits encrypted public requests', async () => {
  await db.query('UPDATE "User" SET "payfastSubscriptionIdHash"=$1,"payfastSubscriptionToken"=$2 WHERE id=$3', ['same-token-hash',new Uint8Array([1,2,3]),'owner-a']);
  await assert.rejects(db.query('UPDATE "User" SET "payfastSubscriptionIdHash"=$1 WHERE id=$2', ['same-token-hash','owner-b']));
  await db.query('INSERT INTO "BillingRequest" (id,"userId",kind,"encryptedContact","encryptedMessage") VALUES ($1,$2,$3,$4,$5)', ['billing-account','owner-a','REFUND',new Uint8Array([3]),new Uint8Array([4])]);
  await db.query('INSERT INTO "BillingRequest" (id,kind,"encryptedContact","encryptedMessage") VALUES ($1,$2,$3,$4)', ['billing-public','CANCELLATION',new Uint8Array([3]),new Uint8Array([4])]);
  const record=(await db.query('SELECT * FROM "BillingRequest" WHERE id=$1',['billing-public'])).rows[0];
  assert.equal(record.userId,null);assert.equal(record.status,'OPEN');assert.equal(record.retentionHold,false);
});

test('account foreign-key cascades remove only the deleted account records', async () => {
  await db.query('INSERT INTO "PrivacyRequest" (id,"userId",kind,"encryptedMessage") VALUES ($1,$2,$3,$4)', ['account-request','owner-a','CORRECTION',new Uint8Array([1])]);
  await db.query('INSERT INTO "Session" (id,"userId","sessionToken",expires) VALUES ($1,$2,$3,NOW())', ['session-a','owner-a','test-session']);
  await db.query('DELETE FROM "User" WHERE id=$1', ['owner-a']);
  for (const table of ['Document','SavedSignature','PrivacyRequest','Session']) assert.equal((await db.query(`SELECT id FROM "${table}" WHERE "userId"=$1`, ['owner-a'])).rows.length, 0, table);
  assert.equal((await db.query('SELECT id FROM "User" WHERE id=$1', ['owner-b'])).rows.length, 1);
  assert.equal((await db.query('SELECT id FROM "SavedSignature" WHERE id=$1', ['sig-b'])).rows.length, 1);
  assert.equal((await db.query('SELECT id FROM "PrivacyRequest" WHERE id=$1', ['public-request'])).rows.length, 1);
});

test('deleting an account detaches outstanding billing cases for justified response handling',async()=>{
  const item=(await db.query('SELECT "userId",status FROM "BillingRequest" WHERE id=$1',['billing-account'])).rows[0];
  assert.equal(item.userId,null);assert.equal(item.status,'OPEN');
});
