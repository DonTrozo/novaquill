import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPreviewPage } from '../src/lib/previewLayout.ts';

test('whole-page fit respects both available dimensions on phone, short and desktop previews', () => {
  for (const viewport of [{width: 340,height: 450},{width: 340,height: 220},{width: 950,height: 600}]) {
    for (const page of [{width: 595,height: 842},{width: 842,height: 595},{width: 400,height: 1400}]) {
      const scale = fitPreviewPage(page, viewport);
      assert.ok(page.width * scale <= viewport.width - 24 + 1e-8);
      assert.ok(page.height * scale <= viewport.height - 24 + 1e-8);
      assert.ok(Math.abs(page.width * scale - (viewport.width - 24)) < 1e-8 || Math.abs(page.height * scale - (viewport.height - 24)) < 1e-8);
    }
  }
});
