import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberTextMove, restoreTextMove } from '../src/lib/textMoveHistory.ts';

const original = { id: 'name', page: 2, x: 120, y: 240, text: 'The green room', width: 200, height: 30, fieldName: 'Business' };

test('Undo restores the position and native field binding without overwriting later text edits', () => {
  const before = rememberTextMove(original, 1.2);
  const moved = { ...original, x: 300, y: 400, fieldName: undefined, sourceFieldName: 'Business', text: 'The Green Room Ltd' };
  const restored = restoreTextMove(moved, before, 1.2);
  assert.equal(restored.x, original.x); assert.equal(restored.y, original.y);
  assert.equal(restored.fieldName, 'Business'); assert.equal(restored.sourceFieldName, undefined);
  assert.equal(restored.text, 'The Green Room Ltd'); assert.equal(restored.width, 200);
  assert.equal(moved.x, 300, 'Undo must not mutate the current entry');
});

test('Undo restores document position after zooming', () => {
  const before = rememberTextMove(original, 1.2);
  const restored = restoreTextMove({ ...original, x: 600, y: 700, width: 400 }, before, 2.4);
  assert.equal(restored.x, 240); assert.equal(restored.y, 480);
  assert.equal(restored.width, 400, 'current zoomed dimensions remain intact');
});

test('successive moves can restore successive previous positions', () => {
  const second = { ...original, x: 200, y: 300 };
  const history = [rememberTextMove(original, 1), rememberTextMove(second, 1)];
  let current = { ...original, x: 450, y: 500 };
  current = restoreTextMove(current, history.pop(), 1);
  assert.equal(current.x, 200); assert.equal(current.y, 300);
  current = restoreTextMove(current, history.pop(), 1);
  assert.equal(current.x, 120); assert.equal(current.y, 240);
});
