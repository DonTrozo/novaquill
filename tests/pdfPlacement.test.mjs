import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
import { pagePlacement, signaturePlacement } from '../src/lib/pdfPlacement.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

for (const rotation of [0, 90, 180, 270]) {
  test(`signature remains on its displayed location on a PDF rotated ${rotation} degrees`, async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    page.setCropBox(20, 30, 500, 700);
    page.setRotation(degrees(rotation));
    const sideways = rotation === 90 || rotation === 270;
    const viewport = { width: (sideways ? 700 : 500) * 1.2, height: (sideways ? 500 : 700) * 1.2 };
    const expected = {
      0: { x: 120, y: 530 },
      90: { x: 220, y: 130 },
      180: { x: 420, y: 230 },
      270: { x: 320, y: 630 },
    }[rotation];
    const center = pagePlacement(page, viewport).point(120, 240);
    near(center.x, expected.x); near(center.y, expected.y);
    const placement = signaturePlacement(page, viewport, { x: 60, y: 216, width: 120, height: 48, rotation: 30 });
    assert.equal(placement.angle, rotation - 30);
    const rad = placement.angle * Math.PI / 180;
    near(placement.x + placement.width / 2 * Math.cos(rad) - placement.height / 2 * Math.sin(rad), center.x);
    near(placement.y + placement.width / 2 * Math.sin(rad) + placement.height / 2 * Math.cos(rad), center.y);
    const zoomed = signaturePlacement(page, { width: viewport.width * 2, height: viewport.height * 2 }, { x: 120, y: 432, width: 240, height: 96, rotation: 30 });
    for (const key of ['x','y','width','height','angle']) near(placement[key], zoomed[key]);
  });
}

test('preserves signature pixels and original document text when embedding a PNG', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.drawText('Original document text');
  const png = await pdf.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  const placement = signaturePlacement(page, { width: 720, height: 960 }, { x: 50, y: 100, width: 120, height: 40, rotation: 15 });
  page.drawImage(png, { ...placement, rotate: degrees(placement.angle) });
  const reopened = await PDFDocument.load(await pdf.save());
  assert.equal(reopened.getPageCount(), 1);
  assert.equal(png.width, 1);
  assert.ok(reopened.getPage(0).node.Contents());
});

test('uses the visible intersection when a CropBox extends beyond the MediaBox', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.setCropBox(-20, -30, 700, 900);
  const point = pagePlacement(page, { width: 600, height: 800 }).point(100, 200);
  near(point.x, 100); near(point.y, 600);
});
