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

test('manual rotation accepts precise fractional angles without snapping to preset steps', async () => {
  const { rotateInkGroup } = await import('../src/lib/documentInk.ts');
  const strokes = [{ groupId: 'free', page: 1, points: [{ x: 200, y: 300 }, { x: 300, y: 300 }], width: 2, color: '#000000', viewport: { width: 600, height: 800 } }];
  for (const angle of [0.25, 7.35, -22.8, 179.9, -179.9]) {
    const rotated = rotateInkGroup(strokes, 'free', 1, angle, { width: 600, height: 800 });
    const [start, end] = rotated[0].points;
    const actualAngle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    assert.ok(Math.abs(actualAngle - angle) < 1e-8);
    assert.ok(Math.abs(Math.hypot(end.x - start.x, end.y - start.y) - 100) < 1e-8);
    assert.equal(rotated[0].width, 2);
  }
});

test('completed line weight edits every stroke of the selected drawing without changing its shape or other pages', async () => {
  const { setInkGroupWidth } = await import('../src/lib/documentInk.ts');
  const strokes = [
    { groupId: 'initials', page: 1, points: [{ x: 500, y: 750 }, { x: 530, y: 770 }], width: 4, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'initials', page: 1, points: [{ x: 520, y: 750 }], width: 3, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'initials', page: 2, points: [{ x: 50, y: 60 }], width: 4, color: '#111111', viewport: { width: 600, height: 800 } },
  ];
  const before = structuredClone(strokes);
  const next = setInkGroupWidth(strokes, 'initials', 1, 0.5);
  assert.equal(next[0].width, 0.5); assert.equal(next[1].width, 0.5); assert.equal(next[2], strokes[2]);
  assert.deepEqual(next[0].points, before[0].points); assert.deepEqual(next[1].points, before[1].points);
  assert.deepEqual(strokes, before);
  for (const width of [0, -1, NaN, Infinity]) assert.equal(setInkGroupWidth(strokes, 'initials', 1, width), strokes);
});

test('repeating multi-stroke initials places one independent copy on each of twelve pages and reapplying does not duplicate', async () => {
  const { repeatInkGroup, inkGroupId } = await import('../src/lib/documentInk.ts');
  const strokes = [
    { groupId: 'initials', page: 3, points: [{ x: 500, y: 750 }, { x: 530, y: 770 }], width: 0.5, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'initials', page: 3, points: [{ x: 520, y: 750 }], width: 0.5, color: '#111111', viewport: { width: 600, height: 800 } },
    { groupId: 'signature', page: 1, points: [{ x: 50, y: 60 }], width: 2, color: '#111111', viewport: { width: 600, height: 800 } },
  ];
  const before = structuredClone(strokes);
  const pages = Array.from({ length: 12 }, () => ({ width: 600, height: 800 }));
  const next = repeatInkGroup(strokes, 'initials', 3, pages);
  assert.equal(next.length, 25);
  const groupIds = new Set();
  for (let page = 1; page <= 12; page++) {
    const group = next.filter(stroke => stroke.page === page && stroke.repeatOf);
    assert.equal(group.length, 2); groupIds.add(inkGroupId(group[0]));
    assert.deepEqual(group[0].points, before[0].points); assert.equal(group[0].width, 0.5);
  }
  assert.equal(groupIds.size, 12); assert.equal(next.find(stroke => stroke.groupId === 'signature'), strokes[2]);
  assert.deepEqual(strokes, before);
  assert.equal(repeatInkGroup(next, 'initials', 3, pages).length, 25);
  const copy = next.find(stroke => stroke.page === 8 && stroke.repeatOf);
  assert.equal(repeatInkGroup(next, inkGroupId(copy), 8, pages).length, 25);
});

test('repeated initials retain physical size and bottom/right margins on differently sized and rotated page viewports', async () => {
  const { repeatInkGroup } = await import('../src/lib/documentInk.ts');
  const stroke = { groupId: 'initials', page: 1, points: [{ x: 500, y: 750 }, { x: 530, y: 770 }], width: 0.5, color: '#111111', viewport: { width: 600, height: 800 } };
  const pages = [{ width: 600, height: 800 }, { width: 800, height: 600 }, { width: 500, height: 700 }];
  const next = repeatInkGroup([stroke], 'initials', 1, pages);
  assert.deepEqual(next[1].points, [{ x: 700, y: 550 }, { x: 730, y: 570 }]);
  assert.deepEqual(next[2].points, [{ x: 400, y: 650 }, { x: 430, y: 670 }]);
  next.forEach((copy, index) => { assert.equal(copy.width, 0.5); assert.deepEqual(copy.viewport, pages[index]); });
  assert.throws(() => repeatInkGroup([stroke], 'initials', 1, [...pages, { width: 10, height: 10 }]), /Make these initials smaller/);
});

test('editing or moving one repeated copy leaves the other pages untouched', async () => {
  const { repeatInkGroup, setInkGroupWidth, transformInkGroup, inkGroupId } = await import('../src/lib/documentInk.ts');
  const source = { groupId: 'a', page: 1, points: [{ x: 50, y: 700 }, { x: 80, y: 720 }], width: 2, color: '#111111', viewport: { width: 600, height: 800 } };
  const copies = repeatInkGroup([source], 'a', 1, [{ width: 600, height: 800 }, { width: 600, height: 800 }]);
  const id = inkGroupId(copies[1]);
  const thin = setInkGroupWidth(copies, id, 2, 0.25);
  assert.equal(thin[0], copies[0]); assert.equal(thin[1].width, 0.25);
  const bounds = inkBounds([thin[1]]);
  const moved = transformInkGroup(thin, id, bounds, { ...bounds, x: bounds.x + 10 });
  assert.equal(moved[0], copies[0]); assert.equal(moved[1].points[0].x, 60);
});
