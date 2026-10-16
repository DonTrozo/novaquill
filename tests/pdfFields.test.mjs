import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { DOMMatrix, Path2D, ImageData } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../src/lib/pdfFields.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"./textLayout"', JSON.stringify(new URL('../src/lib/textLayout.ts', import.meta.url).href));
const { detectPdfFields } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
globalThis.DOMMatrix = DOMMatrix; globalThis.Path2D = Path2D; globalThis.ImageData = ImageData;
const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');

async function detect(bytes, rotation = 0) {
  const task = getDocument({ data: bytes, useSystemFonts: true });
  try {
    const pdf = await task.promise; const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5, rotation });
    const [annotations, text, operators] = await Promise.all([page.getAnnotations(), page.getTextContent(), page.getOperatorList()]);
    return { fields: detectPdfFields(annotations, text.items.filter(item => 'str' in item), operators, OPS, viewport, 1.5, Object.fromEntries(Object.entries(text.styles).map(([name, style]) => [name, { ...style, fontName: page.commonObjs.get(name).name }]))), viewport };
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
  assert.ok(fields.some(item => (item.id.startsWith('box-') || item.id.startsWith('cell-'))));
  assert.ok(fields.some(item => item.id.startsWith('blank-') && item.label === 'Date:'));
});

test('does not offer read-only native fields', async () => {
  const pdf = await PDFDocument.create(); const pg = pdf.addPage([600, 800]);
  const field = pdf.getForm().createTextField('Locked'); field.addToPage(pg, { x: 50, y: 600, width: 200, height: 30 }); field.enableReadOnly();
  const { fields } = await detect(await pdf.save());
  assert.ok(!fields.some(item => item.fieldName === 'Locked'));
});

test('reconstructs empty cells in a ruled agreement table and matches the adjacent label font and size', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([600, 800]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const labels = ['NAMES:', 'PASSPORT NUMBER', 'NATIONALITY', 'COUNTRY OF RESIDENCE'];
  for (const x of [50, 75, 300, 550]) page.drawLine({ start: { x, y: 550 }, end: { x, y: 650 }, thickness: 0.5 });
  for (let i = 0; i <= 4; i++) page.drawLine({ start: { x: 50, y: 650 - i * 25 }, end: { x: 550, y: 650 - i * 25 }, thickness: 0.5 });
  labels.forEach((label, index) => {
    page.drawText(String(index + 1), { x: 57, y: 634 - index * 25, size: 10, font });
    page.drawText(label, { x: 80, y: 634 - index * 25, size: 10, font });
  });
  const { fields } = await detect(await pdf.save());
  const cells = fields.filter(field => field.id.startsWith('cell-'));
  assert.equal(cells.length, 4, 'only the four empty right-hand cells should be fillable');
  cells.forEach((field, index) => {
    assert.equal(field.x, 450); assert.equal(field.y, (150 + index * 25) * 1.5);
    assert.equal(field.width, 375); assert.equal(field.height, 37.5);
    assert.equal(field.fontName, 'Times-Roman'); assert.equal(field.fontSize, 15);
  });
});

test('grid lines made of separate filled rectangles also expose their empty cells', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([600, 800]);
  for (const x of [50, 300, 550]) page.drawRectangle({ x, y: 550, width: 0.5, height: 50 });
  for (const y of [550, 575, 600]) page.drawRectangle({ x: 50, y, width: 500, height: 0.5 });
  page.drawText('Name:', { x: 60, y: 582, size: 10 });
  page.drawText('Passport:', { x: 60, y: 557, size: 10 });
  const { fields } = await detect(await pdf.save());
  assert.equal(fields.filter(field => field.id.startsWith('cell-')).length, 2);
});
