import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { loadSource } from './helpers/loadSource.mjs';
import { allowedRequestOrigin } from '../src/lib/originPolicy.ts';
const url = p => new URL(`../src/${p}`, import.meta.url);
const access = await loadSource(url('lib/subscriptionAccess.ts'));
const payfast = await loadSource(url('lib/payfast.ts'));
const subscription = await loadSource(url('lib/subscription.ts'));
const provider = await loadSource(url('lib/payfastSubscriptions.ts'));
const crypto = await loadSource(url('lib/crypto.ts'));
const limited = await loadSource(url('lib/limitedJson.ts'));
const retention = await loadSource(url('lib/retentionPolicy.ts'));
const keys = ['PAYFAST_MERCHANT_ID','PAYFAST_PASSPHRASE','PAYFAST_ENV','STORAGE_ENCRYPTION_KEY'];
const old = Object.fromEntries(keys.map(k=>[k,process.env[k]])); const originalFetch = globalThis.fetch;
Object.assign(process.env,{PAYFAST_MERCHANT_ID:'10000100',PAYFAST_PASSPHRASE:'fixture passphrase',PAYFAST_ENV:'sandbox',STORAGE_ENCRYPTION_KEY:randomBytes(32).toString('base64')});
test.after(()=>{globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
const token='test-token-123456';
function fixture(overrides={}) {
 const state={session:{user:{id:'owner-a'}},user:{id:'owner-a',email:'a@example.test',subscription:'PRO',subscriptionPlan:'MONTHLY',subscriptionPaidThroughAt:new Date(Date.now()+86400000),subscriptionCancelledAt:null,payfastSubscriptionToken:crypto.encryptBuffer(Buffer.from(token)),payfastSubscriptionIdHash:createHash('sha256').update(token).digest('hex')},events:new Map(),audit:[],cancelCalls:[],requests:[],...overrides};
 const find=async({where})=>state.user && (where.id===state.user.id || where.payfastSubscriptionIdHash===state.user.payfastSubscriptionIdHash)?state.user:null;
 const prisma={user:{findUnique:find,findUniqueOrThrow:async(a)=>{const u=await find(a);if(!u)throw new Error();return u;},update:async({where,data})=>{assert.equal(where.id,'owner-a');Object.assign(state.user,data);return state.user;}},securityEvent:{create:async({data})=>{state.audit.push(data);}},eventCounter:{upsert:async()=>{}},payfastEvent:{create:async({data})=>{if(state.events.has(data.pfPaymentId))throw Object.assign(new Error('duplicate'),{code:'P2002'});state.events.set(data.pfPaymentId,data);return data;},findUnique:async({where})=>state.events.get(where.pfPaymentId)||null},billingRequest:{create:async({data})=>{state.requests.push(data);return{id:'receipt-test',status:'OPEN',createdAt:new Date()};}},$queryRaw:async()=>[]};
 prisma.$transaction=async fn=>{const saved=structuredClone({user:state.user,events:state.events,audit:state.audit});try{return await fn(prisma);}catch(e){Object.assign(state,saved);throw e;}};
 const stubs={'next-auth':{getServerSession:async()=>state.session},'next/server':{NextResponse:{json:Response.json}},'@/lib/auth':{authOptions:{}},'@/lib/prisma':{prisma},'@/lib/guard':{isAllowedOrigin:r=>allowedRequestOrigin(r,[]),rateLimitOk:async()=>true},'@/lib/crypto':crypto,'@/lib/subscriptionAccess':access,'@/lib/payfast':payfast,'@/lib/subscription':subscription,'@/lib/limitedJson':limited,'@/lib/payfastSubscriptions':{cancelPayfastSubscription:async t=>{state.cancelCalls.push(t);if(state.providerFailure)throw new Error('secret provider problem');}}};
 return {state,prisma,stubs};
}
const post=(path,body,origin='https://www.novaquill.co.za')=>new Request(`https://www.novaquill.co.za${path}`,{method:'POST',headers:{origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
function notification(changes={}) {
 const values={merchant_id:'10000100',m_payment_id:'nq_owner-a_monthly_18000_12345',pf_payment_id:'payment-1',payment_status:'COMPLETE',item_name:'NovaQuill Pro (Monthly)',amount_gross:'180.00',custom_str1:'owner-a',custom_str2:'monthly',custom_str3:'NovaQuill Pro (Monthly)',custom_str4:'ZAR',custom_int1:'18000',token,...changes};
 values.signature=payfast.buildSignature(values,process.env.PAYFAST_PASSPHRASE);
 return new Request('https://www.novaquill.co.za/api/payfast/itn',{method:'POST',body:new URLSearchParams(values)});
}

test('paid periods clamp month/year ends and cancelled access expires only at the paid-through instant',()=>{
 assert.equal(access.paidPeriodEnd(new Date('2027-01-31T10:00:00Z'),'MONTHLY').toISOString(),'2027-02-28T10:00:00.000Z');
 assert.equal(access.paidPeriodEnd(new Date('2028-02-29T10:00:00Z'),'ANNUAL').toISOString(),'2029-02-28T10:00:00.000Z');
 const u={subscription:'PRO',subscriptionPaidThroughAt:'2026-11-01T00:00:00Z',subscriptionCancelledAt:'2026-10-10T00:00:00Z'};
 assert.equal(access.hasProAccess(u,new Date('2026-10-31T23:59:59Z')),true);assert.equal(access.hasProAccess(u,new Date('2026-11-01T00:00:00Z')),false);
 assert.equal(access.hasProAccess({subscription:'PRO'}),true);
});

test('API signature sorts passphrase while checkout signature preserves submitted field order',()=>{
 const headers={'merchant-id':'10000100',version:'v1',timestamp:'2026-10-30T12:00:00+00:00'};
 const raw='merchant-id=10000100&passphrase=fixture+passphrase&timestamp=2026-10-30T12%3A00%3A00%2B00%3A00&version=v1';
 assert.equal(provider.payfastApiSignature(headers,'fixture passphrase'),createHash('md5').update(raw).digest('hex'));
 assert.equal(payfast.buildSignature({z:'one',a:'two'},'pass'),createHash('md5').update('z=one&a=two&passphrase=pass').digest('hex'));
});

test('provider cancellation requires affirmative success and never sends the passphrase in a URL',async()=>{
 let call; globalThis.fetch=async(url,options)=>{call={url:String(url),options};return Response.json({status:'success',data:{response:true}});};
 await provider.cancelPayfastSubscription(token);assert.match(call.url,/testing=true$/);assert.equal(call.options.method,'PUT');assert.equal(call.url.includes('passphrase'),false);assert.equal(call.options.headers.signature,provider.payfastApiSignature({'merchant-id':process.env.PAYFAST_MERCHANT_ID,version:'v1',timestamp:call.options.headers.timestamp},process.env.PAYFAST_PASSPHRASE));
 for(const payload of [{status:'success',data:{response:false}},{status:'error'},{}]){globalThis.fetch=async()=>Response.json(payload);await assert.rejects(provider.cancelPayfastSubscription(token));}
});

test('cancellation is account-scoped, origin protected and preserves the paid-through date',async()=>{
 const {state,stubs}=fixture();const route=await loadSource(url('app/api/subscription/cancel/route.ts'),stubs);
 assert.equal((await route.POST(post('/api/subscription/cancel',null,'https://foreign.test'))).status,403);assert.equal(state.cancelCalls.length,0);
 const end=state.user.subscriptionPaidThroughAt.toISOString();const response=await route.POST(post('/api/subscription/cancel',{userId:'owner-b',token:'attacker-token'}));
 assert.equal(response.status,200);assert.deepEqual(state.cancelCalls,[token]);assert.equal(state.user.subscriptionPaidThroughAt.toISOString(),end);assert.equal(access.hasProAccess(state.user),true);
 assert.equal((await route.POST(post('/api/subscription/cancel'))).status,200);assert.equal(state.cancelCalls.length,1);
});

test('unconfirmed and unlinked cancellations are not reported as completed',async()=>{
 const one=fixture({providerFailure:true});let route=await loadSource(url('app/api/subscription/cancel/route.ts'),one.stubs);assert.equal((await route.POST(post('/api/subscription/cancel'))).status,503);assert.equal(one.state.user.subscriptionCancelledAt,null);
 const two=fixture();two.state.user.payfastSubscriptionToken=null;route=await loadSource(url('app/api/subscription/cancel/route.ts'),two.stubs);assert.equal((await route.POST(post('/api/subscription/cancel'))).status,409);assert.equal(two.state.cancelCalls.length,0);
 two.state.session=null;assert.equal((await route.POST(post('/api/subscription/cancel'))).status,401);
});

test('public billing requests encrypt contact/details, never claim account identity and do not cancel a mandate',async()=>{
 const {state,stubs}=fixture({session:null});const route=await loadSource(url('app/api/billing/requests/route.ts'),stubs);
 const response=await route.POST(post('/api/billing/requests',{kind:'CANCELLATION',contactEmail:'reply@example.test',message:'My reference is private-123',userId:'owner-a'}));
 assert.equal(response.status,201);assert.equal((await response.json()).completed,false);assert.equal(state.requests[0].userId,null);assert.equal(state.cancelCalls.length,0);assert.equal(Buffer.from(state.requests[0].encryptedMessage).includes(Buffer.from('private-123')),false);assert.equal(crypto.decryptBuffer(Buffer.from(state.requests[0].encryptedContact),true).toString(),'reply@example.test');
 assert.equal((await route.POST(post('/api/billing/requests',{kind:'REFUND',contactEmail:'x@example.test',message:'x',website:'bot'}))).status,400);
});

test('verified payment records encrypted mandate and a paid period atomically; duplicates do not extend it',async()=>{
 globalThis.fetch=async()=>new Response('VALID');const {state,stubs}=fixture();const route=await loadSource(url('app/api/payfast/itn/route.ts'),stubs);
 assert.equal((await route.POST(notification())).status,200);const end=state.user.subscriptionPaidThroughAt.toISOString();assert.equal(state.events.size,1);assert.equal(crypto.decryptBuffer(Buffer.from(state.user.payfastSubscriptionToken),true).toString(),token);assert.equal(JSON.stringify([...state.events.values()]).includes(token),false);
 assert.equal((await route.POST(notification())).status,200);assert.equal(state.events.size,1);assert.equal(state.user.subscriptionPaidThroughAt.toISOString(),end);
});

test('a signed but provider-rejected notification cannot grant access or install a token',async()=>{
 globalThis.fetch=async()=>new Response('INVALID');const {state,stubs}=fixture();const route=await loadSource(url('app/api/payfast/itn/route.ts'),stubs);const old=state.user.subscriptionPaidThroughAt.toISOString();
 assert.equal((await route.POST(notification())).status,400);assert.equal(state.events.size,0);assert.equal(state.user.subscriptionPaidThroughAt.toISOString(),old);
});

test('verified cancellation and failed renewal retain the paid period; late successful debit does not revive a cancelled mandate',async()=>{
 globalThis.fetch=async()=>new Response('VALID');const {state,stubs}=fixture();const route=await loadSource(url('app/api/payfast/itn/route.ts'),stubs);const end=state.user.subscriptionPaidThroughAt.toISOString();
 assert.equal((await route.POST(notification({payment_status:'CANCELLED'}))).status,200);assert.equal(state.user.subscriptionPaidThroughAt.toISOString(),end);assert.ok(state.user.subscriptionCancelledAt);const cancelled=state.user.subscriptionCancelledAt.toISOString();
 assert.equal((await route.POST(notification({payment_status:'FAILED'}))).status,200);assert.equal(state.user.subscriptionPaidThroughAt.toISOString(),end);assert.equal(access.hasProAccess(state.user),true);
 assert.equal((await route.POST(notification())).status,200);assert.equal(state.user.subscriptionCancelledAt.toISOString(),cancelled);
});

test('bad amount, duplicate fields and database failures are not acknowledged as successful payment handling',async()=>{
 globalThis.fetch=async()=>new Response('VALID');const {state,stubs,prisma}=fixture();const route=await loadSource(url('app/api/payfast/itn/route.ts'),stubs);
 assert.equal((await route.POST(notification({amount_gross:'1.00'}))).status,400);
 const original=notification();const raw=await original.text();assert.equal((await route.POST(new Request(original.url,{method:'POST',body:raw+'&custom_str1=owner-b'}))).status,400);
 prisma.payfastEvent.create=async()=>{throw new Error('database unavailable')};assert.equal((await route.POST(notification())).status,503);assert.equal(state.events.size,0);
});

test('the public retention periods and cleanup use the same bounded operational defaults',()=>{
 assert.deepEqual(retention.retentionPeriods({}),{securityDays:90,requestDays:365});assert.deepEqual(retention.retentionPeriods({SECURITY_LOG_RETENTION_DAYS:'7',PRIVACY_REQUEST_RETENTION_DAYS:'31'}),{securityDays:7,requestDays:31});assert.equal(retention.retentionPeriods({SECURITY_LOG_RETENTION_DAYS:'-1'}).securityDays,null);
});

test('checkout values cannot inject scripts or attributes into the payment form',()=>{
 const form=payfast.buildForm({name_first:'"><script>alert(1)</script>',email_address:"a'b@example.test"},'https://sandbox.payfast.co.za/eng/process');
 assert.equal(form.includes('<script>'),false);assert.ok(form.includes('&lt;script&gt;'));assert.ok(form.includes('&#39;'));
});

test('an uncertain provider response is successful only after an explicit cancelled-state reconciliation',async()=>{
 let calls=0;
 globalThis.fetch=async()=>{calls++;return calls===1?Response.json({status:'failed',data:{response:false}}):Response.json({status:'success',data:{response:{status_text:'CANCELLED',token}}});};
 await provider.cancelPayfastSubscription(token);assert.equal(calls,2);
 globalThis.fetch=async()=>Response.json({status:'success',data:{response:{status_text:'ACTIVE',token}}});
 await assert.rejects(provider.cancelPayfastSubscription(token));
});

test('a checkout completing after deletion stops its new mandate and records a private billing case',async()=>{
 globalThis.fetch=async()=>new Response('VALID');const {state,stubs}=fixture({user:null});const route=await loadSource(url('app/api/payfast/itn/route.ts'),stubs);
 assert.equal((await route.POST(notification({email_address:'reply@example.test'}))).status,200);assert.deepEqual(state.cancelCalls,[token]);assert.equal(state.requests.length,1);assert.equal(state.requests[0].userId,undefined);assert.equal(state.events.get('payment-1').payload.paymentStatus,'REVIEW_AFTER_DELETION');
});
