import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers/loadSource.mjs';
const source = path => new URL(`../src/${path}`, import.meta.url);
const access = await loadSource(source('lib/subscriptionAccess.ts'));
const quota = await loadSource(source('lib/signingQuota.ts'), { './subscriptionAccess': access });
const owner = 'trozo.antonio@gmail.com';

function fixture(email = owner) {
  const state = { session: { user: { id: 'authenticated-user', email: 'untrusted-session@example.test' } }, user: { id: 'authenticated-user', email, subscription: 'FREE', usageYearMonth: quota.usageMonth(), docsUsedThisMonth: 50 }, writes: [], checkoutCalls: 0 };
  const prisma = { user: {
    findUnique: async ({ where, select }) => {
      assert.equal(where.id, state.session.user.id);
      if (!state.user) return null;
      return select ? Object.fromEntries(Object.keys(select).map(key => [key, state.user[key]])) : { ...state.user };
    },
    updateMany: async ({ data }) => { state.writes.push(data); Object.assign(state.user, data); return { count: 1 }; },
  } };
  const stubs = {
    'next-auth': { getServerSession: async () => state.session },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/subscriptionAccess': access, '@/lib/signingQuota': quota,
    '@/lib/guard': { isAllowedOrigin: () => true, rateLimitOk: async () => true },
  };
  return { state, stubs, prisma };
}
const request = () => new Request('https://www.novaquill.co.za/api/usage', { method: 'POST', body: JSON.stringify({ email: owner }), headers: { origin: 'https://www.novaquill.co.za' } });

test('only the exact owner email receives complimentary access, ignoring case and surrounding spaces', () => {
  for (const email of [owner, 'Trozo.Antonio@Gmail.com', ' TROZO.ANTONIO@gmail.com ']) {
    assert.equal(access.hasOwnerAccess({ email }), true);
    assert.equal(access.hasProAccess({ email, subscription: 'FREE', subscriptionPaidThroughAt: '2000-01-01' }), true);
  }
  for (const email of [null, undefined, '', 'trozoantonio@gmail.com', 'trozo.antonio+owner@gmail.com', 'trozo.antonio@gmail.com.attacker.test', 'other@gmail.com']) {
    assert.equal(access.hasOwnerAccess({ email }), false);
    assert.equal(access.hasProAccess({ email, subscription: 'FREE' }), false);
  }
  assert.equal(access.paidThrough({ email: owner, subscription: 'FREE' }), null);
});

test('owner usage stays unlimited beyond five documents without setting a paid subscription', async () => {
  const { state, stubs } = fixture();
  const route = await loadSource(source('app/api/usage/route.ts'), stubs);
  const usage = await (await route.GET()).json();
  assert.equal(usage.owner, true); assert.equal(usage.limit, null);
  for (let i = 0; i < 8; i++) {
    const response = await route.POST(request());
    assert.equal(response.status, 200); assert.equal((await response.json()).remaining, null);
  }
  assert.equal(state.user.docsUsedThisMonth, 58);
  assert.equal(state.user.subscription, 'FREE');
  assert.ok(state.writes.every(data => Object.keys(data).every(key => ['usageYearMonth', 'docsUsedThisMonth'].includes(key))));
});

test('session and submitted emails cannot give another account the owner exemption', async () => {
  const { state, stubs } = fixture('regular@example.test');
  state.session.user.email = owner; state.user.docsUsedThisMonth = 5;
  const route = await loadSource(source('app/api/usage/route.ts'), stubs);
  const usage = await (await route.GET()).json();
  assert.equal(usage.owner, false); assert.equal(usage.limit, 5); assert.equal(usage.subscription, 'FREE');
  assert.equal((await route.POST(request())).status, 402); assert.equal(state.writes.length, 0);
  state.session = null;
  assert.equal((await route.POST(request())).status, 401);
  assert.equal((await (await route.GET()).json()).subscription, 'ANON');
});

test('owner subscription status reports complimentary access without fabricating payment dates', async () => {
  const { state, stubs } = fixture();
  const route = await loadSource(source('app/api/subscription/route.ts'), stubs);
  const result = await (await route.GET()).json();
  assert.equal(result.owner, true); assert.equal(result.pro, true);
  assert.equal(result.paidThrough, null); assert.equal(result.canCancel, false); assert.equal(result.needsBillingHelp, false);
  assert.equal(state.writes.length, 0);
});

test('owner checkout stops before creating payment authority or looking up an exchange rate', async () => {
  const { state, stubs } = fixture();
  const subscription = await loadSource(source('lib/subscription.ts'));
  const fail = () => { state.checkoutCalls++; throw new Error('must not start checkout'); };
  const route = await loadSource(source('app/api/subscribe/[plan]/route.ts'), {
    ...stubs, '@/lib/subscription': subscription,
    '@/lib/payfast': { buildForm: fail, buildSignature: fail, getPayfastEndpoint: fail },
    '@/lib/checkoutReview': { checkoutReview: fail }, '@/lib/requestLocale': { requestLocale: fail }, '@/lib/fx': { eurToZar: fail },
  });
  const response = await route.GET(new Request('https://www.novaquill.co.za/api/subscribe/monthly'), { params: Promise.resolve({ plan: 'monthly' }) });
  assert.equal(response.status, 409); assert.match(await response.text(), /complimentary owner access/);
  assert.equal(state.checkoutCalls, 0); assert.equal(state.writes.length, 0);
});
