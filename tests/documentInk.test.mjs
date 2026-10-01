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
