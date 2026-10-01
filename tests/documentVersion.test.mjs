import test from 'node:test';
import assert from 'node:assert/strict';
import { documentVersion } from '../src/lib/documentVersion.ts';

const input = { fileName: 'contract.pdf', fileSize: 1000, fileLastModified: 123, sigDataUrl: 'data:image/png;base64,fixture', page: 1, x: 100, y: 200, width: 180, height: 60, rotation: 15,
  textElements: [{ page: 1, x: 80, y: 90, width: 200, height: 36, text: 'Antonio', fontSize: 14 }], inkStrokes: [], viewportSizes: { 1: { width: 600, height: 800 } } };

test('changing zoom does not charge for a new document', () => {
  const zoomed = { ...input, x: input.x * 1.3, y: input.y * 1.3, width: input.width * 1.3, height: input.height * 1.3,
    textElements: input.textElements.map((item) => ({ ...item, x: item.x * 1.3, y: item.y * 1.3, width: item.width * 1.3, height: item.height * 1.3, fontSize: item.fontSize * 1.3 })), viewportSizes: { 1: { width: 780, height: 1040 } } };
  assert.equal(documentVersion(input), documentVersion(zoomed));
});

test('editing content produces a new output identity', () => {
  assert.notEqual(documentVersion(input), documentVersion({ ...input, rotation: 30 }));
  assert.notEqual(documentVersion(input), documentVersion({ ...input, textElements: [{ ...input.textElements[0], text: 'Changed' }] }));
  assert.notEqual(documentVersion(input), documentVersion({ ...input, inkStrokes: [{ page: 1, points: [{ x: 100, y: 200 }], color: '#000000', width: 2, viewport: { width: 600, height: 800 } }] }));
});
