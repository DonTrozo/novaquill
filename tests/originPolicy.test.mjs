import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedRequestOrigin} from '../src/lib/originPolicy.ts';
const req = origin => new Request('https://www.novaquill.co.za/api/usage', {headers: origin ? {origin} : {}});
test('legitimate production same-origin posts work even with stale auth host configuration', () => assert.equal(allowedRequestOrigin(req('https://www.novaquill.co.za'), ['https://novaquill.co.za']), true));
test('full URL and host-only explicit origins both work', () => {
 const r=new Request('https://internal.vercel.app/api/usage',{headers:{origin:'https://www.novaquill.co.za'}});
 assert.equal(allowedRequestOrigin(r,['https://www.novaquill.co.za']),true);
 assert.equal(allowedRequestOrigin(r,['www.novaquill.co.za']),true);
});
test('unlisted cross-site origins and lookalike domains are rejected', () => {
 for(const o of ['https://evil.example','https://www.novaquill.co.za.evil.example','null','https://www.novaquill.co.za/path']) assert.equal(allowedRequestOrigin(req(o),['https://novaquill.co.za']),false);
});
test('explicit HTTPS URL does not permit HTTP origin', () => assert.equal(allowedRequestOrigin(req('http://novaquill.co.za'),['https://novaquill.co.za']),false));
