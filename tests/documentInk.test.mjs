import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothInk, inkBounds, inkPath } from '../src/lib/documentInk.ts';

test('smoothing preserves signature endpoints and never changes the input strokes', () => {
  const points = [{ x: 10, y: 20 }, { x: 20, y: 70 }, { x: 30, y: 20 }, { x: 40, y: 30 }];
  const snapshot = structuredClone(points);
  const smoothed = smoothInk(points, 0.9);
  assert.deepEqual(smoothed[0], points[0]); assert.deepEqual(smoothed.at(-1), points.at(-1));
  assert.deepEqual(points, snapshot); assert.ok(smoothed[1].y < points[1].y);
  assert.deepEqual(smoothInk(points, 0), points);
});

test('saving handwriting crops only ink, including pen thickness, without including the PDF', () => {
  const bounds = inkBounds([{ page: 1, points: [{ x: 100, y: 200 }, { x: 140, y: 220 }], width: 4, color: '#000000', viewport: { width: 600, height: 800 } }]);
  assert.deepEqual(bounds, { x: 96, y: 196, width: 48, height: 28 });
  assert.equal(inkBounds([]), null);
});

test('overlay and export use the same smooth path through the original endpoints', () => {
  assert.equal(inkPath([{ x: 10, y: 20 }, { x: 20, y: 40 }, { x: 30, y: 20 }]), 'M 10 20 Q 20 40 25 30 L 30 20');
  assert.equal(inkPath([]), '');
});

test('moving and resizing a completed signature transforms all its strokes while preserving other signatures and pages', async () => {
  const { transformInkGroup } = await import('../src/lib/documentInk.ts');
  const strokes = [
    { groupId: 'a', page: 1, points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], width: 2, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'a', page: 1, points: [{ x: 20, y: 30 }], width: 2, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'b', page: 1, points: [{ x: 200, y: 300 }], width: 2, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'c', page: 2, points: [{ x: 100, y: 200 }], width: 2, color: '#111111', viewport: { width: 600, height: 800 } },
  ];
  const before = structuredClone(strokes);
  const next = transformInkGroup(strokes, 'a', { x: 10, y: 20, width: 20, height: 20 }, { x: 100, y: 200, width: 40, height: 40 });
  assert.deepEqual(next[0].points, [{ x: 100, y: 200 }, { x: 140, y: 240 }]);
  assert.deepEqual(next[1].points, [{ x: 120, y: 220 }]); assert.equal(next[0].width, 4);
  assert.equal(next[2], strokes[2]); assert.equal(next[3], strokes[3]); assert.deepEqual(strokes, before);
});

test('rotation turns every stroke around the signature centre without changing its shape or other signatures', async () => {
  const { rotateInkGroup } = await import('../src/lib/documentInk.ts');
  const strokes = [
    { groupId: 'a', page: 1, points: [{ x: 100, y: 200 }, { x: 140, y: 200 }], width: 4, color: '#000000', viewport: { width: 600, height: 800 } },
    { groupId: 'a', page: 1, points: [{ x: 120, y: 200 }], width: 4, color: '#000000', viewport: { width: 600, height: 800 } },
    { groupId: 'b', page: 1, points: [{ x: 300, y: 400 }], width: 2, color: '#000000', viewport: { width: 600, height: 800 } },
    { groupId: 'a', page: 2, points: [{ x: 300, y: 400 }], width: 2, color: '#000000', viewport: { width: 600, height: 800 } },
  ];
  const snapshot = structuredClone(strokes);
  const next = rotateInkGroup(strokes, 'a', 1, 90, { width: 600, height: 800 });
  assert.deepEqual(next[0].points, [{ x: 120, y: 180 }, { x: 120, y: 220 }]);
  assert.deepEqual(next[1].points, [{ x: 120, y: 200 }]);
  assert.equal(next[0].width, 4); assert.equal(next[2], strokes[2]); assert.equal(next[3], strokes[3]);
  assert.deepEqual(strokes, snapshot);
  const reversed = rotateInkGroup(next, 'a', 1, -90, { width: 600, height: 800 });
  reversed[0].points.forEach((point, index) => { assert.ok(Math.abs(point.x - strokes[0].points[index].x) < 1e-8); assert.ok(Math.abs(point.y - strokes[0].points[index].y) < 1e-8); });
});

test('rotating near a page edge keeps the complete signature visible without shrinking it', async () => {
  const { rotateInkGroup } = await import('../src/lib/documentInk.ts');
  const strokes = [{ groupId: 'edge', page: 1, points: [{ x: 10, y: 10 }, { x: 100, y: 10 }], width: 4, color: '#000000', viewport: { width: 600, height: 800 } }];
  const next = rotateInkGroup(strokes, 'edge', 1, 90, { width: 600, height: 800 });
  const bounds = inkBounds(next);
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 600 && bounds.y + bounds.height <= 800);
  assert.ok(Math.abs(Math.hypot(next[0].points[1].x - next[0].points[0].x, next[0].points[1].y - next[0].points[0].y) - 90) < 1e-8);
});

test('rotation that cannot fit on the page preserves the original signature', async () => {
  const { rotateInkGroup } = await import('../src/lib/documentInk.ts');
  const strokes = [{ groupId: 'wide', page: 1, points: [{ x: 10, y: 40 }, { x: 500, y: 40 }], width: 4, color: '#000000', viewport: { width: 600, height: 100 } }];
  assert.equal(rotateInkGroup(strokes, 'wide', 1, 90, { width: 600, height: 100 }), strokes);
});
