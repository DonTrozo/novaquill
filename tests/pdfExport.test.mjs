import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { PDFDocument, PDFName, PDFRawStream, degrees } from 'pdf-lib';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const path = new URL('../src/lib/buildSignedPdf.ts', import.meta.url);
const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"pdf-lib"', JSON.stringify(new URL(`file://${require.resolve('pdf-lib')}`).href))
  .replace('"./pdfPlacement"', JSON.stringify(new URL('../src/lib/pdfPlacement.ts', import.meta.url).href))
  .replace('"./documentInk"', JSON.stringify(new URL('../src/lib/documentInk.ts', import.meta.url).href));
const { buildSignedPdf } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name); const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, crc]);
}
function signaturePng(width, height) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    pixels[offset + 2] = 180; pixels[offset + 3] = Math.abs(y - x * height / width) < 8 ? 255 : 0;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

test('actual exporter preserves high-resolution signature, searchable original text and page count', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.drawText('Original document text', { x: 50, y: 700 });
  const second = pdf.addPage([600, 800]);
  second.setRotation(degrees(90));
  const png = signaturePng(1800, 600);
  const out = await buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: `data:image/png;base64,${png.toString('base64')}`, page: 2, x: 100, y: 200, width: 240, signatureHeight: 80, rotation: 30,
    textElements: [{ id: 'name', page: 1, x: 100, y: 300, width: 200, height: 36, fontSize: 14, text: 'Trozo Antonio' }],
    pdfViewportSizes: { 1: { width: 720, height: 960 }, 2: { width: 960, height: 720 } } });
  const reopened = await PDFDocument.load(out);
  assert.equal(reopened.getPageCount(), 2);
  assert.equal(reopened.getPage(1).getRotation().angle, 90);
  const images = reopened.context.enumerateIndirectObjects().map(([, object]) => object).filter((object) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
  assert.ok(images.some((image) => image.dict.get(PDFName.of('Width'))?.asNumber() === 1800 && image.dict.get(PDFName.of('Height'))?.asNumber() === 600));
  const extracted = spawnSync('pdftotext', ['-', '-'], { input: Buffer.from(out), encoding: 'utf8' });
  if (!extracted.error) { assert.equal(extracted.status, 0); assert.match(extracted.stdout, /Original document text/); assert.match(extracted.stdout, /Trozo Antonio/); }
});

test('exporting a form without a signature works', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([600, 800]);
  const out = await buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: null, page: 1, x: 0, y: 0, width: 200, signatureHeight: 80, rotation: 0,
    textElements: [{ id: 'checkbox', page: 1, x: 40, y: 40, width: 32, height: 32, fontSize: 18, text: 'X' }], pdfViewportSizes: {} });
  assert.equal((await PDFDocument.load(out)).getPageCount(), 1);
});

test('missing signature page produces an error instead of silently signing a different page', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([600, 800]);
  await assert.rejects(buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: `data:image/png;base64,${signaturePng(10,10).toString('base64')}`, page: 2, x: 0, y: 0, width: 200, signatureHeight: 80, rotation: 0, textElements: [], pdfViewportSizes: {} }), /page that no longer exists/);
});

test('legacy saved JPEG signatures export successfully at their original resolution', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([600, 800]);
  const jpeg = readFileSync(new URL('./fixtures/signature.jpg', import.meta.url));
  const out = await buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`, page: 1, x: 10, y: 10, width: 160, signatureHeight: 80, rotation: 0, textElements: [], pdfViewportSizes: {} });
  const reopened = await PDFDocument.load(out);
  const images = reopened.context.enumerateIndirectObjects().map(([, object]) => object).filter((object) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
  assert.ok(images.some((image) => image.dict.get(PDFName.of('Width'))?.asNumber() === 32 && image.dict.get(PDFName.of('Height'))?.asNumber() === 16));
});

for (const angle of [0, 90, 180, 270]) {
  test(`direct handwriting exports at the drawn position on a page rotated ${angle} degrees`, async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]); page.setCropBox(20, 30, 500, 700); page.setRotation(degrees(angle));
    const sideways = angle === 90 || angle === 270;
    const ink = { page: 1, points: [{ x: 100, y: 200 }, { x: 140, y: 200 }], color: '#ff0000', width: 4, viewport: { width: sideways ? 700 : 500, height: sideways ? 500 : 700 } };
    const parameters = { pdfBytes: await pdf.save(), sigDataUrl: null, page: 1, x: 0, y: 0, width: 200, signatureHeight: 80, rotation: 0, textElements: [], pdfViewportSizes: {}, inkStrokes: [ink] };
    const out = await buildSignedPdf(parameters);
    const reopened = await PDFDocument.load(out);
    const images = reopened.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype'))?.toString() === '/Image');
    assert.equal(images.length, 0, 'direct ink must stay vector, rather than becoming a signature image');
    const folder = mkdtempSync(join(tmpdir(), 'novaquill-ink-'));
    try {
      const file = join(folder, 'signed.pdf'); writeFileSync(file, out);
      const rendered = spawnSync('pdftoppm', ['-r', '72', '-cropbox', '-singlefile', file, join(folder, 'page')]);
      if (!rendered.error) {
        assert.equal(rendered.status, 0, rendered.stderr.toString());
        const ppm = readFileSync(join(folder, 'page.ppm'));
        const header = /^P6\s+(\d+)\s+(\d+)\s+255\s/.exec(ppm.toString('latin1'));
        assert.ok(header); const width = Number(header[1]); const height = Number(header[2]);
        assert.equal(width, ink.viewport.width); assert.equal(height, ink.viewport.height);
        const pixels = ppm.subarray(header[0].length);
        const offset = (200 * width + 110) * 3;
        assert.ok(pixels[offset] > 200 && pixels[offset + 1] < 80 && pixels[offset + 2] < 80, 'red ink should appear at the exact on-document coordinates');
      }
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
}

test('direct ink supports several pages and a one-point dot', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage([600, 800]); pdf.addPage([600, 800]);
  const strokes = [1, 2].map((page) => ({ page, points: [{ x: 30, y: 40 }], color: '#0000ff', width: 2, viewport: { width: 600, height: 800 } }));
  const out = await buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: null, page: 1, x: 0, y: 0, width: 200, signatureHeight: 80, rotation: 0, textElements: [], pdfViewportSizes: {}, inkStrokes: strokes });
  const reopened = await PDFDocument.load(out);
  assert.equal(reopened.getPageCount(), 2);
  assert.ok(reopened.getPage(0).node.Contents()); assert.ok(reopened.getPage(1).node.Contents());
});

test('detected native form fields export their entered values and flatten without hiding the text', async () => {
  const pdf = await PDFDocument.create(); const pg = pdf.addPage([600, 800]);
  const field = pdf.getForm().createTextField('Full name'); field.addToPage(pg, { x: 100, y: 650, width: 250, height: 30 }); field.setText('Old value');
  const out = await buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: null, page: 1, x: 0, y: 0, width: 200, signatureHeight: 80, rotation: 0, textElements: [{ id: 'native', fieldName: 'Full name', page: 1, x: 100, y: 120, width: 250, height: 30, fontSize: 14, text: 'Mock Completed Name' }], pdfViewportSizes: { 1: { width: 600, height: 800 } } });
  const reopened = await PDFDocument.load(out); assert.equal(reopened.getForm().getFields().length, 0);
  const extracted = spawnSync('pdftotext', ['-', '-'], { input: Buffer.from(out), encoding: 'utf8' });
  assert.equal(extracted.status, 0); assert.match(extracted.stdout, /Mock Completed Name/); assert.doesNotMatch(extracted.stdout, /Old value/);
});

test('small numeric font sizes survive zoom and export for placed text and native fields', async () => {
  const { DOMMatrix, Path2D, ImageData } = await import('@napi-rs/canvas');
  globalThis.DOMMatrix = DOMMatrix; globalThis.Path2D = Path2D; globalThis.ImageData = ImageData;
  const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  for (const native of [false, true]) for (const zoom of [0.5, 2]) for (const points of [1, 5.5]) {
    const pdf = await PDFDocument.create(); const page = pdf.addPage([600, 800]);
    if (native) {
      const field = pdf.getForm().createTextField('Name');
      field.addToPage(page, { x: 100, y: 600, width: 250, height: 30 });
      field.setText('Old');
      field.acroField.setDefaultAppearance(`${field.acroField.getDefaultAppearance()}\n1 g`);
    }
    const out = await buildSignedPdf({ pdfBytes: await pdf.save(), sigDataUrl: null, page: 1, x: 0, y: 0, width: 200, signatureHeight: 80, rotation: 0,
      textElements: [{ id: 'small', ...(native ? { fieldName: 'Name' } : {}), page: 1, x: 100 * zoom, y: 170 * zoom, width: 250 * zoom, height: 30 * zoom, fontSize: points * zoom, text: 'Small text' }],
      pdfViewportSizes: { 1: { width: 600 * zoom, height: 800 * zoom } } });
    const task = getDocument({ data: out, useSystemFonts: true });
    try {
      const result = await task.promise; const pg = await result.getPage(1); const text = await pg.getTextContent();
      const item = text.items.find(item => item.str === 'Small text');
      assert.ok(item, `text missing: native=${native}, zoom=${zoom}, points=${points}`);
      assert.ok(Math.abs(item.height - points) < 0.01, `export size ${item.height} must equal ${points} pt`);
      const operators = await pg.getOperatorList();
      const colours = operators.fnArray.flatMap((fn, index) => fn === OPS.setFillRGBColor ? [operators.argsArray[index]] : []);
      assert.ok(colours.some(args => args[0] === '#000000' || Array.from(args).every(value => value === 0)), 'exported text must use black, including fields originally configured white');
    } finally { await task.destroy(); }
  }
});
