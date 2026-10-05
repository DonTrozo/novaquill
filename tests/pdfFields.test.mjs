import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { DOMMatrix, Path2D, ImageData } from '@napi-rs/canvas';
import { detectPdfFields } from '../src/lib/pdfFields.ts';
globalThis.DOMMatrix = DOMMatrix; globalThis.Path2D = Path2D; globalThis.ImageData = ImageData;
const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');

async function detect(bytes, rotation = 0) {
  const task = getDocument({ data: bytes, useSystemFonts: true });
  try {
    const pdf = await task.promise; const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5, rotation });
    const [annotations, text, operators] = await Promise.all([page.getAnnotations(), page.getTextContent(), page.getOperatorList()]);
    return { fields: detectPdfFields(annotations, text.items.filter(item => 'str' in item), operators, OPS, viewport, 1.5), viewport };
  } finally { await task.destroy(); }
}

test('detects real PDF text widgets at their exact viewport positions at all page rotations', async () => {
  const pdf = await PDFDocument.create(); const pg = pdf.addPage([600, 800]);
  const field = pdf.getForm().createTextField('Full name'); field.addToPage(pg, { x: 160, y: 620, width: 250, height: 30 });
  field.setText('Existing name');
  for (const rotation of [0, 90, 180, 270]) {
    const { fields, viewport } = await detect(await pdf.save(), rotation);
    const native = fields.find(item => item.fieldName === 'Full name');
    assert.ok(native); assert.equal(native.value, 'Existing name');
    const r = viewport.convertToViewportRectangle([159.5, 619.5, 410.5, 650.5]);
    assert.equal(native.x, Math.min(r[0], r[2])); assert.equal(native.y, Math.min(r[1], r[3]));
    assert.equal(native.width, Math.abs(r[2] - r[0])); assert.equal(native.height, Math.abs(r[3] - r[1]));
  }
});

test('suggests printed empty boxes, labelled rules and underline blanks from a real PDF', async () => {
  const pdf = await PDFDocument.create(); const pg = pdf.addPage([600, 800]); const font = await pdf.embedFont(StandardFonts.Helvetica);
  pg.drawText('Name:', { x: 45, y: 650, size: 14, font });
  pg.drawLine({ start: { x: 140, y: 648 }, end: { x: 420, y: 648 }, thickness: 1 });
  pg.drawRectangle({ x: 140, y: 510, width: 280, height: 30, borderWidth: 1 });
  pg.drawText('Date: ____________', { x: 45, y: 420, size: 14, font });
  const { fields } = await detect(await pdf.save());
  assert.ok(fields.some(item => item.id.startsWith('line-') && item.label === 'Name:'));
  assert.ok(fields.some(item => item.id.startsWith('box-')));
  assert.ok(fields.some(item => item.id.startsWith('blank-') && item.label === 'Date:'));
});

test('does not offer read-only native fields', async () => {
  const pdf = await PDFDocument.create(); const pg = pdf.addPage([600, 800]);
  const field = pdf.getForm().createTextField('Locked'); field.addToPage(pg, { x: 50, y: 600, width: 200, height: 30 }); field.enableReadOnly();
  const { fields } = await detect(await pdf.save());
  assert.ok(!fields.some(item => item.fieldName === 'Locked'));
});
