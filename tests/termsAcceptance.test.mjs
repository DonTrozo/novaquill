import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';
import { LEGAL_POLICY_VERSION } from '../src/lib/legalVersion.ts';
import { allowedRequestOrigin } from '../src/lib/originPolicy.ts';
const source = path => new URL(`../src/${path}`, import.meta.url);
const limited = await loadSource(source('lib/limitedJson.ts'));
const version = { LEGAL_POLICY_VERSION };
const policies = await loadSource(source('lib/legalPolicies.ts'), { './legalVersion': version });
const body = extra => ({ acceptTerms: true, termsVersion: LEGAL_POLICY_VERSION, ...extra });
const request = (data, origin = 'https://www.novaquill.co.za') => new Request('https://www.novaquill.co.za/api/terms-acceptance', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(data) });
function fixture() {
  const state = { session: { user: { id: 'owner-a' } }, user: { id: 'owner-a', termsAcceptedVersion: null, termsAcceptedAt: null }, writes: [], allowed: true };
  const prisma = { user: {
    findUnique: async ({ where }) => { assert.equal(where.id, 'owner-a'); return state.user; },
    updateMany: async ({ where, data }) => {
      assert.equal(where.id, 'owner-a'); assert.deepEqual(where.OR, [{ termsAcceptedVersion: null }, { termsAcceptedVersion: { not: LEGAL_POLICY_VERSION } }]);
      if (state.fail) throw new Error('private database problem');
      if (!state.user || state.user.termsAcceptedVersion === LEGAL_POLICY_VERSION) return { count: 0 };
      state.writes.push(data); Object.assign(state.user, data); return { count: 1 };
    },
    create: async ({ data }) => { state.writes.push(data); return { ...data, id: 'owner-a' }; },
  } };
  const stubs = { 'next-auth': { getServerSession: async () => state.session }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma }, '@/lib/guard': { isAllowedOrigin: req => allowedRequestOrigin(req, []), rateLimitOk: async () => state.allowed }, '@/lib/limitedJson': limited, '@/lib/legalVersion': version, bcryptjs: { hash: async () => 'hash' } };
  return { state, stubs };
}

test('terms acceptance rejects foreign origins, missing sessions and stale accounts', async () => {
  const { state, stubs } = fixture(); const route = await loadSource(source('app/api/terms-acceptance/route.ts'), stubs);
  assert.equal((await route.POST(request(body(), 'https://foreign.test'))).status, 403);
  state.session = null; assert.equal((await route.POST(request(body()))).status, 401); assert.equal((await route.GET()).status, 401);
  state.session = { user: { id: 'owner-a' } }; state.user = null;
  assert.equal((await route.POST(request(body()))).status, 401); assert.equal((await route.GET()).status, 401); assert.equal(state.writes.length, 0);
});

test('only explicit current-version acceptance is saved with server time and session identity', async () => {
  const { state, stubs } = fixture(); const route = await loadSource(source('app/api/terms-acceptance/route.ts'), stubs);
  for (const values of [{ acceptTerms: false }, { acceptTerms: 'true' }, { termsVersion: 'old' }, { termsVersion: null }]) assert.equal((await route.POST(request(body(values)))).status, 409);
  assert.equal(state.writes.length, 0);
  const before = Date.now(); const response = await route.POST(request(body({ userId: 'owner-b', termsAcceptedAt: '1990-01-01' })));
  assert.equal(response.status, 200); assert.equal(state.writes.length, 1); assert.equal(state.user.termsAcceptedVersion, LEGAL_POLICY_VERSION);
  assert.ok(state.user.termsAcceptedAt.getTime() >= before); assert.ok(state.user.termsAcceptedAt.getTime() <= Date.now());
  const first = state.user.termsAcceptedAt; await route.POST(request(body())); assert.equal(state.user.termsAcceptedAt, first); assert.equal(state.writes.length, 1);
  const status = await route.GET(); assert.match(status.headers.get('cache-control'), /no-store/); assert.equal((await status.json()).accepted, true);
});

test('rate limits, malformed/oversized input and database errors never confirm acceptance', async () => {
  const { state, stubs } = fixture(); const route = await loadSource(source('app/api/terms-acceptance/route.ts'), stubs);
  state.allowed = false; assert.equal((await route.POST(request(body()))).status, 429); state.allowed = true;
  assert.equal((await route.POST(request(body({ junk: 'x'.repeat(1500) })))).status, 413);
  assert.equal((await route.POST(new Request('https://www.novaquill.co.za/api/terms-acceptance', { method: 'POST', body: '{bad' }))).status, 400);
  state.fail = true; const response = await route.POST(request(body())); assert.equal(response.status, 503); assert.equal((await response.text()).includes('private database'), false); assert.equal(state.writes.length, 0);
});

test('registration rejects missing agreement and records agreement atomically with account creation', async () => {
  const { state, stubs } = fixture(); state.user = null;
  const route = await loadSource(source('app/api/register/route.ts'), stubs);
  const details = { email: ' NEW@example.test ', password: 'long-enough-password' };
  assert.equal((await route.POST(request(details))).status, 400); assert.equal(state.writes.length, 0);
  assert.equal((await route.POST(request({ ...details, ...body(), termsVersion: 'old' }))).status, 400);
  // Registration looks up the normalized email rather than an account id.
  stubs['@/lib/prisma'].prisma.user.findUnique = async ({ where }) => { assert.equal(where.email, 'new@example.test'); return null; };
  const response = await route.POST(request({ ...details, ...body(), termsAcceptedAt: '1990-01-01' }));
  assert.equal(response.status, 201); assert.equal(state.writes.length, 1); assert.equal(state.writes[0].termsAcceptedVersion, LEGAL_POLICY_VERSION); assert.ok(state.writes[0].termsAcceptedAt instanceof Date);
});

test('the downloadable contractual archive matches the exact bilingual policy arrays', () => {
  const archive = JSON.parse(readFileSync(new URL(`../docs/privacy/versions/${LEGAL_POLICY_VERSION}.json`, import.meta.url), 'utf8'));
  assert.equal(archive.version, LEGAL_POLICY_VERSION);
  for (const key of ['termsSections', 'subscriptionSections', 'browserStorageSections']) assert.deepEqual(archive[key], policies[key]);
});

test('PayFast checkout displays full policy text with the amount and requires an unchecked acknowledgement', async () => {
  const retention = await loadSource(source('lib/retentionPolicy.ts'));
  const privacy = await loadSource(source('lib/privacyNotice.ts'), {'./retentionPolicy':retention});
  const review = await loadSource(source('lib/checkoutReview.ts'), {'./legalPolicies':policies,'./legalVersion':version,'./privacyNotice':privacy});
  const payfast = await loadSource(source('lib/payfast.ts'));
  const html = payfast.buildForm({amount:'180.00',name_first:'<script>bad</script>'},'https://sandbox.payfast.co.za/eng/process',review.checkoutReview('180.00','monthly','en'));
  assert.match(html,/ZAR 180.00 \/ month/);assert.match(html,/<input type="checkbox" required>/);assert.equal(html.includes(' checked'),false);
  assert.equal(html.includes('onload='),false);assert.match(html,/within seven days after conclusion/);assert.match(html,/Refunds and payment disputes/);assert.match(html,/Digital delivery and service activation/);
  assert.equal(html.includes('<script>bad</script>'),false);assert.match(html,/merchant account verification is pending/);
  const pt=payfast.buildForm({},'https://sandbox.payfast.co.za/eng/process',review.checkoutReview('180.00','annual','pt'));
  assert.match(pt,/ZAR 180.00 \/ ano/);assert.match(pt,/nos sete dias após/);
});

test('live checkout stays closed until explicit activation even when merchant credentials exist', async () => {
  const saved = Object.fromEntries(['PAYFAST_ENV','PAYFAST_PAYMENTS_ENABLED','PAYFAST_MERCHANT_ID','PAYFAST_MERCHANT_KEY','PAYFAST_PASSPHRASE'].map(k=>[k,process.env[k]]));
  let fxCalls=0;
  try {
    Object.assign(process.env,{PAYFAST_ENV:'live',PAYFAST_PAYMENTS_ENABLED:'false',PAYFAST_MERCHANT_ID:'fixture',PAYFAST_MERCHANT_KEY:'fixture',PAYFAST_PASSPHRASE:'fixture'});
    const subscription=await loadSource(source('lib/subscription.ts'));
    const payfast=await loadSource(source('lib/payfast.ts'));
    const route=await loadSource(source('app/api/subscribe/[plan]/route.ts'),{
      'next-auth':{getServerSession:async()=>({user:{id:'owner-a'}})},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma:{user:{findUnique:async()=>({id:'owner-a',subscription:'FREE'})}}},
      '@/lib/payfast':payfast,'@/lib/subscription':subscription,'@/lib/fx':{eurToZar:async()=>{fxCalls++;return 180;}},'@/lib/checkoutReview':{checkoutReview:()=>{throw new Error('must not build payment');}},'@/lib/requestLocale':{requestLocale:async()=> 'en'},
    });
    const response=await route.GET(new Request('https://www.novaquill.co.za/api/subscribe/monthly'),{params:Promise.resolve({plan:'monthly'})});
    assert.equal(response.status,503);assert.match(await response.text(),/awaiting merchant approval/);assert.equal(fxCalls,0);
  } finally { for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;} }
});
