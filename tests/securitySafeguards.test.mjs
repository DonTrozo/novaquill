import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';
import { allowedRequestOrigin } from '../src/lib/originPolicy.ts';

const url = (path) => new URL(`../src/${path}`, import.meta.url);
const crypto = await loadSource(url('lib/crypto.ts'));
const signature = await loadSource(url('lib/signatureStorage.ts'), { '@/lib/crypto': crypto });
const limited = await loadSource(url('lib/limitedJson.ts'));
const previousKey = process.env.STORAGE_ENCRYPTION_KEY;
process.env.STORAGE_ENCRYPTION_KEY = randomBytes(32).toString('base64');
test.after(() => { if (previousKey === undefined) delete process.env.STORAGE_ENCRYPTION_KEY; else process.env.STORAGE_ENCRYPTION_KEY = previousKey; });
const jpeg = `data:image/jpeg;base64,${readFileSync(new URL('./fixtures/signature.jpg', import.meta.url)).toString('base64')}`;

function context(overrides = {}) {
  const state = { session: { user: { id: 'owner-a', email: 'same@example.test' } }, user: { id: 'owner-a', email: 'same@example.test', subscription: 'PRO' }, doc: { id: 'doc-a', userId: 'owner-a', filename: 'signed.pdf', path: 'cloudinary:old', mimeType: 'application/pdf' }, events: [], deletedFiles: [], dbDeleted: false, signatureWrites: [], ...overrides };
  const prisma = {
    user: { findUnique: async ({ where }) => { assert.deepEqual(where, { id: state.session.user.id }); return state.user; }, delete: async () => { state.dbDeleted = true; } },
    document: { findUnique: async () => state.doc, findMany: async ({ where }) => { assert.deepEqual(where, { userId: 'owner-a' }); return [state.doc]; }, delete: async () => { state.dbDeleted = true; } },
    savedSignature: { count: async () => 0, findUnique: async () => state.savedSignature ?? null, create: async ({ data }) => { state.signatureWrites.push(data); return { ...data, id: 'sig-a', createdAt: new Date() }; }, delete: async () => { state.dbDeleted = true; }, findMany: async () => [] },
    securityEvent: { create: async ({ data }) => state.events.push(data), deleteMany: async () => ({ count: 1 }), findMany: async () => [] },
    payfastEvent: { findMany: async () => [] },
    privacyRequest: { updateMany: async () => ({ count: 0 }), create: async ({ data }) => { state.request = data; return { id: 'request-a', kind: data.kind, status: 'OPEN', createdAt: new Date() }; }, findMany: async () => [] },
    $queryRaw: async () => [{ id: 'owner-a' }],
  };
  prisma.$transaction = async (action) => typeof action === 'function' ? action(prisma) : Promise.all(action);
  const stubs = {
    'next-auth': { getServerSession: async () => state.session }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/guard': { isAllowedOrigin: (req) => allowedRequestOrigin(req, []), rateLimitOk: async () => true },
    '@/lib/crypto': crypto, '@/lib/signatureStorage': signature, '@/lib/limitedJson': limited,
    '@/lib/securityAudit': { recordSecurityEvent: async (action, actorId, targetId, digest) => state.events.push({ action, actorId, targetId, digest }) },
    '@/lib/storage': { readFileAbsolute: async () => { state.read = true; return Buffer.from('%PDF-test'); }, deleteFileAbsolute: async (path) => { if (state.storageFailure) throw new Error('provider secret'); state.deletedFiles.push(path); } },
  };
  return { state, prisma, stubs };
}
const request = (path = '/api/signatures', body, origin = 'https://www.novaquill.co.za', method = 'POST') => new Request(`https://www.novaquill.co.za${path}`, { method, headers: { origin, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = { params: Promise.resolve({ id: 'doc-a' }) };

test('AES-GCM uses unique nonces and rejects tampered content, keys and missing envelopes', () => {
  const plaintext = Buffer.from('sensitive signature and contract');
  const one = crypto.encryptBuffer(plaintext), two = crypto.encryptBuffer(plaintext);
  assert.notDeepEqual(one, two); assert.equal(one.includes(plaintext), false);
  assert.deepEqual(crypto.decryptBuffer(one, true), plaintext);
  for (const index of [0, 3, 16, 31]) { const changed = Buffer.from(one); changed[index] ^= 1; assert.throws(() => crypto.decryptBuffer(changed, true)); }
  const key = process.env.STORAGE_ENCRYPTION_KEY; process.env.STORAGE_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  assert.throws(() => crypto.decryptBuffer(one, true)); process.env.STORAGE_ENCRYPTION_KEY = key;
  assert.throws(() => crypto.decryptBuffer(Buffer.from('NG1'), true));
});

test('saved signature validation rejects SVG, HTML disguised as an image and oversized data', () => {
  assert.equal(signature.validateSignatureDataUrl(jpeg).ok, true);
  for (const input of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,PGh0bWw+', 'data:image/jpeg;base64,abcd', 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024), 'data:image/png;base64,====']) assert.equal(signature.validateSignatureDataUrl(input).ok, false);
});

test('actual request stream is bounded even when Content-Length is absent or false', async () => {
  assert.deepEqual(await limited.readLimitedJson(request('/api/test', { a: 1 }), 20), { a: 1 });
  for (const headers of [{}, { 'content-length': '1' }]) {
    const req = new Request('https://example.test', { method: 'POST', headers, body: JSON.stringify({ a: 'x'.repeat(100) }) });
    await assert.rejects(limited.readLimitedJson(req, 20), (err) => err.status === 413);
  }
  await assert.rejects(limited.readLimitedJson(new Request('https://example.test', { method: 'POST', body: '{broken' }), 30), (err) => err.status === 400);
});

test('multipart upload bounds preserve ordinary PDF uploads and reject excessive fields', async () => {
  const form = new FormData(); form.set('file', new Blob(['%PDF-test']), 'test.pdf');
  const encoded = new Request('https://example.test', { method: 'POST', body: form });
  const contentType = encoded.headers.get('content-type');
  const bytes = await encoded.arrayBuffer();
  const req = () => new Request('https://example.test', { method: 'POST', headers: { 'content-type': contentType }, body: bytes });
  assert.equal(await (await limited.readLimitedFormData(req(), 1024)).get('file').text(), '%PDF-test');
  await assert.rejects(limited.readLimitedFormData(req(), 16), (err) => err.status === 413);
});

test('cross-site browser requests without Origin are rejected while same-origin native clients remain usable', () => {
  assert.equal(allowedRequestOrigin(new Request('https://www.novaquill.co.za/api/test', { headers: { 'sec-fetch-site': 'cross-site' } }), []), false);
  assert.equal(allowedRequestOrigin(new Request('https://www.novaquill.co.za/api/test'), []), true);
});

test('document read and delete cannot cross account boundaries', async () => {
  for (const method of ['GET', 'DELETE']) {
    const { state, stubs } = context({ doc: { id: 'private', userId: 'owner-b' } });
    const route = await loadSource(url('app/api/documents/[id]/route.ts'), stubs);
    const response = await route[method](request('/api/documents/private', undefined, undefined, method), params);
    assert.equal(response.status, 403); assert.equal(state.read, undefined); assert.equal(state.dbDeleted, false); assert.deepEqual(state.deletedFiles, []);
    assert.equal(state.events[0].action, 'document.denied');
  }
});

test('account and document deletion reject foreign origins before touching authentication or storage', async () => {
  for (const path of ['app/api/documents/[id]/route.ts', 'app/api/dsar/delete/route.ts']) {
    const { state, stubs } = context(); const route = await loadSource(url(path), stubs);
    const method = path.includes('[id]') ? 'DELETE' : 'POST';
    const response = await route[method](request('/api/delete', undefined, 'https://foreign.example', method), params);
    assert.equal(response.status, 403); assert.equal(state.dbDeleted, false); assert.deepEqual(state.deletedFiles, []);
  }
});

test('a stale session cannot regain access through a recreated account with the same email', async () => {
  const { state, stubs } = context({ user: null });
  const route = await loadSource(url('app/api/documents/route.ts'), stubs);
  assert.equal((await route.GET()).status, 401); assert.equal(state.dbDeleted, false);
});

test('failed blob removal keeps document/account records available for retry', async () => {
  for (const path of ['app/api/documents/[id]/route.ts', 'app/api/dsar/delete/route.ts']) {
    const { state, stubs } = context({ storageFailure: true }); const route = await loadSource(url(path), stubs);
    const method = path.includes('[id]') ? 'DELETE' : 'POST';
    const response = await route[method](request('/api/delete', undefined, undefined, method), params);
    assert.equal(response.status, 503); assert.equal(state.dbDeleted, false); assert.equal((await response.text()).includes('secret'), false);
  }
});

test('ordinary document downloads preserve bytes and safely encode hostile filenames', async () => {
  const { state, stubs } = context(); state.doc.filename = 'contract"\r\nX-Injected: yes João.pdf';
  const route = await loadSource(url('app/api/documents/[id]/route.ts'), stubs);
  const response = await route.GET(request('/api/documents/doc-a', undefined, undefined, 'GET'), params);
  assert.equal(response.status, 200); assert.equal(await response.text(), '%PDF-test');
  assert.equal(response.headers.get('x-injected'), null); assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8''contract%22X-Injected/);
  assert.equal(state.events[0].action, 'document.read');
});

test('the signature API requires a deliberate storage choice and encrypts the selected image', async () => {
  const { state, stubs } = context(); const route = await loadSource(url('app/api/signatures/route.ts'), stubs);
  for (const saveForFuture of [undefined, false, 'true']) assert.equal((await route.POST(request('/api/signatures', { dataUrl: jpeg, saveForFuture }))).status, 400);
  assert.equal(state.signatureWrites.length, 0);
  assert.equal((await route.POST(request('/api/signatures', { dataUrl: jpeg, saveForFuture: true }))).status, 201);
  assert.equal(state.signatureWrites[0].userId, 'owner-a'); assert.equal(state.signatureWrites[0].encryptedPayload.includes(Buffer.from(jpeg)), false);
  assert.equal(signature.decryptSignatureDataUrl(state.signatureWrites[0].encryptedPayload), jpeg);
  assert.equal(state.events[0].action, 'signature.saved.explicit-v1');
  assert.equal(JSON.stringify(state.events).includes(jpeg), false);
});

test('deleting a reusable signature never deletes completed documents or another user signature', async () => {
  const { state, stubs } = context({ savedSignature: { id: 'sig-b', userId: 'owner-b' } });
  const route = await loadSource(url('app/api/signatures/route.ts'), stubs);
  assert.equal((await route.DELETE(request('/api/signatures?id=sig-b', undefined, undefined, 'DELETE'))).status, 403);
  assert.equal(state.dbDeleted, false);
  state.savedSignature = { id: 'sig-a', userId: 'owner-a' };
  assert.equal((await route.DELETE(request('/api/signatures?id=sig-a', undefined, undefined, 'DELETE'))).status, 204);
  assert.deepEqual(state.deletedFiles, []);
});

test('privacy requests encrypt their contents and return a receipt without reflecting the message', async () => {
  const { state, stubs } = context(); const route = await loadSource(url('app/api/dsar/requests/route.ts'), stubs);
  const response = await route.POST(request('/api/dsar/requests', { kind: 'CORRECTION', message: 'Correct my private address' }));
  assert.equal(response.status, 201); assert.equal((await response.json()).request.id, 'request-a');
  assert.equal(state.request.encryptedMessage.includes(Buffer.from('private address')), false);
  assert.equal(crypto.decryptBuffer(state.request.encryptedMessage, true).toString(), 'Correct my private address');
  assert.equal((await route.POST(request('/api/dsar/requests', { kind: 'ADMIN', message: 'anything' }))).status, 400);
});

test('privacy export contains signatures, account details and only the requesting account audit records', async () => {
  const { prisma, stubs } = context();
  prisma.user.findUnique = async ({ where }) => { assert.deepEqual(where, { id: 'owner-a' }); return { id: 'owner-a', passwordHash: 'NEVER-EXPORT', access_token: 'TOKEN' }; };
  prisma.savedSignature.findMany = async ({ where }) => { assert.deepEqual(where, { userId: 'owner-a' }); return [{ id: 'sig-a', encryptedPayload: signature.encryptSignatureDataUrl(jpeg) }]; };
  prisma.securityEvent.findMany = async ({ where }) => { assert.deepEqual(where, { actorId: 'owner-a' }); return []; };
  const route = await loadSource(url('app/api/dsar/export/route.ts'), stubs); const response = await route.GET();
  const body = await response.json(); assert.equal(body.savedSignatures[0].dataUrl, jpeg);
  assert.equal(JSON.stringify(body).includes('NEVER-EXPORT'), false); assert.equal(JSON.stringify(body).includes('TOKEN'), false);
  assert.equal(body.documents[0].path, undefined);
});

test('new cloud objects hide filenames and require authenticated delivery with expiring server-side URLs', async () => {
  const prior = { CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET };
  Object.assign(process.env, { CLOUDINARY_CLOUD_NAME: 'TEST_ONLY', CLOUDINARY_API_KEY: 'TEST_ONLY', CLOUDINARY_API_SECRET: 'TEST_ONLY' });
  const previousFetch = globalThis.fetch; const calls = {};
  const cloudinary = { config: () => {}, uploader: {
    upload: async (body, options) => { calls.upload = { body, options }; return { public_id: options.public_id }; },
    destroy: async (id, options) => { calls.destroy = { id, options }; return { result: calls.deleteFailed ? 'error' : 'ok' }; },
  }, utils: { private_download_url: (id, format, options) => { calls.url = { id, format, options }; return 'https://api.cloudinary.com/test-only'; } }, api: { resource: async () => ({ secure_url: 'https://res.cloudinary.com/legacy' }) } };
  try {
    globalThis.fetch = async (value, options) => { calls.fetch = { value, options }; return new Response('encrypted'); };
    const cloud = await loadSource(url('lib/cloudinary.ts'), { cloudinary: { v2: cloudinary } });
    const id = cloud.makeCloudinaryPublicId('owner-a', 'PRIVATE-NAME-CONTRACT.pdf');
    assert.equal(id.includes('PRIVATE-NAME'), false);
    const path = await cloud.uploadCloudinaryRaw(id, crypto.encryptBuffer(Buffer.from('private document')));
    assert.equal(calls.upload.options.type, 'authenticated'); assert.match(path, /^cloudinary:authenticated:/);
    await cloud.readCloudinaryRaw(path); assert.equal(calls.url.options.type, 'authenticated');
    assert.ok(calls.url.options.expires_at <= Math.floor(Date.now() / 1000) + 60);
    assert.equal(calls.fetch.options.cache, 'no-store');
    await cloud.readCloudinaryRaw('cloudinary:old'); assert.equal(calls.fetch.value, 'https://res.cloudinary.com/legacy');
    await cloud.deleteCloudinaryRaw(path); assert.equal(calls.destroy.options.type, 'authenticated');
    calls.deleteFailed = true; await assert.rejects(cloud.deleteCloudinaryRaw(path));
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('the storage layer uploads encrypted bytes and rejects damaged new envelopes', async () => {
  let payload;
  const cloud = { assertStorageConfigured() {}, isCloudinaryEnabled: () => true, makeCloudinaryPublicId: () => 'opaque', uploadCloudinaryRaw: async (id, bytes) => { payload = bytes; return 'cloudinary:authenticated:opaque'; }, readCloudinaryRaw: async () => payload, deleteCloudinaryRaw: async () => { throw new Error('provider error'); } };
  const storage = await loadSource(url('lib/storage.ts'), { '@/lib/crypto': crypto, '@/lib/cloudinary': cloud });
  const pdf = new TextEncoder().encode('%PDF-sensitive');
  const saved = await storage.saveUserPdf('owner-a', 'private.pdf', pdf.buffer);
  assert.equal(payload.includes(Buffer.from('%PDF-sensitive')), false);
  assert.deepEqual(await storage.readFileAbsolute(saved.absPath), Buffer.from(pdf));
  payload = Buffer.from(payload); payload[0] ^= 1; await assert.rejects(storage.readFileAbsolute(saved.absPath));
  await assert.rejects(storage.deleteFileAbsolute(saved.absPath));
});

test('retention requires a secret and approved periods, and cannot delete open requests or signed contracts', async () => {
  const prior = { CRON_SECRET: process.env.CRON_SECRET, SECURITY_LOG_RETENTION_DAYS: process.env.SECURITY_LOG_RETENTION_DAYS, PRIVACY_REQUEST_RETENTION_DAYS: process.env.PRIVACY_REQUEST_RETENTION_DAYS };
  const actions = []; const secret = randomBytes(32).toString('hex');
  const prisma = { securityEvent: { deleteMany: (args) => { actions.push(['logs', args]); return { count: 1 }; } }, privacyRequest: { deleteMany: (args) => { actions.push(['requests', args]); return { count: 2 }; } }, $transaction: (jobs) => Promise.all(jobs) };
  try {
    delete process.env.CRON_SECRET;
    const route = await loadSource(url('app/api/internal/privacy-retention/route.ts'), { '@/lib/prisma': { prisma } });
    const req = (authorization = `Bearer ${secret}`) => new Request('https://www.novaquill.co.za/api/internal/privacy-retention', { headers: { authorization } });
    assert.equal((await route.GET(req())).status, 503); process.env.CRON_SECRET = secret;
    assert.equal((await route.GET(req('Bearer wrong'))).status, 401);
    delete process.env.SECURITY_LOG_RETENTION_DAYS; assert.equal((await route.GET(req())).status, 503);
    Object.assign(process.env, { SECURITY_LOG_RETENTION_DAYS: '90', PRIVACY_REQUEST_RETENTION_DAYS: '365' });
    assert.equal((await route.GET(req())).status, 200);
    assert.equal(actions[1][1].where.status, 'CLOSED'); assert.ok(actions[1][1].where.resolvedAt.lt instanceof Date);
    assert.equal(actions[0][1].where.createdAt.lt.toISOString().slice(0, 10), new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
  } finally { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('authentication carries the immutable token subject, checks verified Google email and throttles guessing', async () => {
  const checks = []; let permitted = true;
  const auth = await loadSource(url('lib/auth.ts'), {
    '@auth/prisma-adapter': { PrismaAdapter: () => ({}) },
    'next-auth/providers/credentials': { default: (config) => ({ ...config, id: 'credentials' }) },
    'next-auth/providers/google': { default: (config) => config }, 'next-auth/providers/apple': { default: (config) => config },
    '@/lib/prisma': { prisma: { user: { findUnique: async ({ where }) => { checks.push(where); return { id: 'original-id', email: where.email, passwordHash: 'HASH' }; } } } },
    bcryptjs: { compare: async () => true }, '@/lib/guard': { rateLimitOk: async (key) => { checks.push(key); return permitted; } },
  });
  const options = auth.authOptions;
  const session = await options.callbacks.session({ session: { user: { email: 'reused@example.test' } }, token: { sub: 'original-id' } });
  assert.equal(session.user.id, 'original-id');
  assert.equal(await options.callbacks.signIn({ account: { provider: 'google' }, profile: { email_verified: false } }), false);
  assert.equal(await options.callbacks.signIn({ account: { provider: 'google' }, profile: { email_verified: true } }), true);
  const credentials = options.providers.find((item) => item.id === 'credentials');
  const user = await credentials.authorize({ email: ' USER@example.test ', password: 'ordinary password' }, { headers: {} });
  assert.equal(user.id, 'original-id'); assert.deepEqual(checks.at(-1), { email: 'user@example.test' });
  permitted = false; assert.equal(await credentials.authorize({ email: 'user@example.test', password: 'guess' }, { headers: {} }), null);
});

test('successful account deletion locks before cleanup and requests browser state removal', async () => {
  const { state, prisma, stubs } = context(); const sequence = [];
  prisma.$queryRaw = async () => { sequence.push('lock'); return [{ id: 'owner-a' }]; };
  prisma.document.findMany = async () => { sequence.push('list'); return [state.doc]; };
  prisma.user.delete = async () => { sequence.push('delete-account'); state.dbDeleted = true; };
  stubs['@/lib/storage'].deleteFileAbsolute = async () => sequence.push('delete-file');
  const route = await loadSource(url('app/api/dsar/delete/route.ts'), stubs);
  const response = await route.POST(request('/api/dsar/delete'));
  assert.equal(response.status, 204); assert.deepEqual(sequence, ['lock', 'list', 'delete-file', 'delete-account']);
  assert.equal(response.headers.get('clear-site-data'), '"cache", "cookies", "storage"');
  assert.equal(state.events.at(-1).action, 'account.deleted'); assert.equal(state.events.at(-1).actorId, null);
});

test('analytics rejects personal text instead of storing it as an event name', async () => {
  const { prisma, stubs } = context(); const writes = [];
  prisma.eventCounter = { upsert: async (args) => writes.push(args) };
  const route = await loadSource(url('app/api/analytics/route.ts'), stubs);
  assert.equal((await route.POST(request('/api/analytics', { name: 'private-address@example.test' }))).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await route.POST(request('/api/analytics', { name: 'home_upload_select' }))).status, 204);
  assert.equal(writes[0].where.name, 'home_upload_select');
});

test('public health failures do not reveal database connection errors', async () => {
  const route = await loadSource(url('app/api/health/route.ts'), { '@/lib/prisma': { prisma: { $queryRaw: async () => { throw new Error('postgresql://user:SECRET@private-host'); } } }, ioredis: { default: class {} } });
  const response = await route.GET();
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('SECRET'), false);
});

test('people without accounts can submit encrypted requests without claiming an account identity', async () => {
  const { state, stubs } = context({ session: null });
  const route = await loadSource(url('app/api/dsar/requests/route.ts'), stubs);
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(request('/api/dsar/requests', { kind: 'ACCESS', message: 'My data is in a customer document' }))).status, 400);
  const response = await route.POST(request('/api/dsar/requests', { kind: 'ACCESS', message: 'My data is in a customer document', contactEmail: 'requester@example.test', userId: 'owner-b' }));
  assert.equal(response.status, 201); assert.equal(state.request.userId, null);
  assert.equal(crypto.decryptBuffer(state.request.encryptedContact, true).toString(), 'requester@example.test');
  assert.equal(state.request.encryptedContact.includes(Buffer.from('requester@example.test')), false);
  assert.equal(state.events.at(-1).actorId, null);
});

test('the public rights form rejects bot fields and cross-origin submissions', async () => {
  const { state, stubs } = context({ session: null });
  const route = await loadSource(url('app/api/dsar/requests/route.ts'), stubs);
  assert.equal((await route.POST(request('/api/dsar/requests', { kind: 'ACCESS', message: 'request', contactEmail: 'a@example.test', website: 'spam' }))).status, 400);
  assert.equal((await route.POST(request('/api/dsar/requests', { kind: 'ACCESS', message: 'request', contactEmail: 'a@example.test' }, 'https://foreign.example'))).status, 403);
  assert.equal(state.request, undefined);
});

test('account deletion detaches held privacy records and does not purge held security evidence', async () => {
  const { prisma, stubs } = context(); const calls = [];
  prisma.privacyRequest.updateMany = async (args) => { calls.push(['held-requests', args]); return { count: 1 }; };
  prisma.securityEvent.deleteMany = async (args) => { calls.push(['events', args]); return { count: 1 }; };
  const route = await loadSource(url('app/api/dsar/delete/route.ts'), stubs);
  assert.equal((await route.POST(request('/api/dsar/delete'))).status, 204);
  assert.deepEqual(calls[0][1], { where: { userId: 'owner-a', retentionHold: true }, data: { userId: null } });
  assert.equal(calls[1][1].where.retentionHold, false);
});
