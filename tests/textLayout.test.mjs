import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText, scaleText, matchingFont } from '../src/lib/textLayout.ts';

const name = { x: 200, y: 150, width: 230, height: 20, text: 'Joaquim Domingos Antonio', fontSize: 10, preferredFontSize: 10, fontName: 'Helvetica', padding: 2, autoFit: true };

test('entries keep the matched size when they fit and automatically shrink long names into a cell', () => {
  const normal = layoutText(name);
  assert.equal(normal.size, 10);
  const long = layoutText({ ...name, width: 85 });
  assert.ok(long.size < 10); assert.ok(long.textWidth <= 81 + 1e-8);
  assert.ok(long.baseline > 0 && long.baseline < name.height);
  assert.equal(layoutText({ ...name, text: '' }).size, 10);
});

test('zooming scales cell text, padding and baseline in the same ratio as the PDF', () => {
  const original = layoutText({ ...name, width: 85 });
  for (const ratio of [0.25, 0.7, 1.5, 3]) {
    const scaled = scaleText({ ...name, width: 85 }, ratio), layout = layoutText(scaled);
    assert.ok(Math.abs(layout.size - original.size * ratio) < 1e-8);
    assert.ok(Math.abs(layout.baseline - original.baseline * ratio) < 1e-8);
    assert.ok(Math.abs(layout.textWidth - original.textWidth * ratio) < 1e-8);
    assert.equal(scaled.x, 200 * ratio); assert.equal(scaled.y, 150 * ratio);
  }
});

test('common PDF fonts retain family and bold/italic styling', () => {
  assert.equal(matchingFont('ABCDEE+TimesNewRomanPS-BoldItalicMT'), 'Times-BoldItalic');
  assert.equal(matchingFont('ArialMT'), 'Helvetica');
  assert.equal(matchingFont('Courier New', true, false), 'Courier-Bold');
});
