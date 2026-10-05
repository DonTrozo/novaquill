import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { saveSigningDraft, loadSigningDraft, clearSigningDraft } from '../src/lib/signingDraft.ts';
import { authReturnPath } from '../src/lib/authReturn.ts';

test('document and editor state survive the full sign-in redirect and are cleared after download', async () => {
  const file = new File(['%PDF-test'], 'example.pdf', { type: 'application/pdf', lastModified: 12345 });
  const editor = { sigDataUrl: null, signaturePage: 1, signaturePlaced: false, pos: { x: 20, y: 20 }, signatureSize: { width: 200, height: 80 }, signatureRotation: 0, page: 2, scale: 0.75, inkStrokes: [{ groupId: 'signature', page: 2, points: [{ x: 120, y: 230 }], color: '#111111', width: 2, viewport: { width: 600, height: 800 } }], textElements: [{ id: 'field', fieldName: 'Full name', page: 1, x: 30, y: 40, width: 200, height: 30, fontSize: 14, text: 'Mock User' }], pdfPageSizes: { 1: { width: 450, height: 600 }, 2: { width: 450, height: 600 } } };
  await saveSigningDraft(file, editor);
  const saved = await loadSigningDraft();
  assert.equal(saved.file.name, file.name); assert.equal(saved.file.lastModified, 12345); assert.equal(await saved.file.text(), '%PDF-test');
  assert.deepEqual(saved.editor, editor);
  await clearSigningDraft(); assert.equal(await loadSigningDraft(), null);
});

test('stale documents expire instead of remaining on a shared browser indefinitely', async () => {
  const now = Date.now; const file = new File(['%PDF'], 'old.pdf');
  try {
    Date.now = () => 1000;
    await saveSigningDraft(file, {});
    Date.now = () => 1000 + 24 * 60 * 60 * 1000 + 1;
    assert.equal(await loadSigningDraft(), null);
  } finally { Date.now = now; }
});

test('sign-in and registration return to the editor without allowing external redirects', () => {
  assert.equal(authReturnPath('/sign'), '/sign');
  for (const value of [null, 'https://evil.example', '//evil.example', '/\\evil.example']) assert.equal(authReturnPath(value), '/dashboard');
});
