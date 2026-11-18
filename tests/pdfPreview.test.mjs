import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
import { pdfCanvasSize } from '../src/lib/pdfCanvasSize.ts';
import { fitPreviewPage } from '../src/lib/previewLayout.ts';

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { devicePixelRatio: 3 };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
let loading, renders, failRender;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const pdf = {
  numPages: 12,
  getPage: async number => ({
    getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
    render: options => {
      renders.push({ number, ...options });
      return { promise: failRender ? Promise.reject(new Error('Canvas unavailable')) : Promise.resolve(), cancel() {} };
    },
  }),
};
// Run the actual component and React effects, with only PDF.js/browser boundaries doubled.
const source = readFileSync(new URL('../src/components/PdfViewer.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const stubs = {
  '@/context/LanguageContext': { useLanguage: () => ({ t: (key, values) => values ? key.replace('{page}', values.page) : key }) },
  '@/context/UploadContext': { useUpload: () => ({ file: null }) },
  'pdfjs-dist': { getDocument: () => ({ promise: loading.promise, destroy: async () => {} }), GlobalWorkerOptions: {}, OPS: {} },
  '@/lib/pdfFields': { detectPdfFields: () => [] },
  './LoadingSpinner': { default: ({ text }) => React.createElement('span', null, text) },
  '@/lib/previewLayout': { fitPreviewPage },
  '@/lib/pdfCanvasSize': { pdfCanvasSize },
};
globalThis.__previewBoundaries = stubs;
const js = compiled.replace(/from (["'])([^"']+)\1/g, (match, quote, name) => {
  if (name === 'react' || name === 'react/jsx-runtime') return `from ${JSON.stringify(new URL(`file://${require.resolve(name)}`).href)}`;
  const exports = Object.keys(stubs[name]).map(key => key === 'default' ? `export default globalThis.__previewBoundaries[${JSON.stringify(name)}].default;` : `export const ${key} = globalThis.__previewBoundaries[${JSON.stringify(name)}][${JSON.stringify(key)}];`).join('\n');
  return `from "data:text/javascript;base64,${Buffer.from(exports).toString('base64')}"`;
});
const { PdfDocumentPreview } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function nodeMock(element) {
  if (element.type === 'canvas') { const node = { style: {}, width: 300, height: 150 }; node.getContext = () => ({ canvas: node }); return node; }
  return { clientWidth: 338, clientHeight: 480, scrollTo() {} };
}

test('twelve-page preview waits for metadata, paints the visible canvas, and navigates all pages', async () => {
  loading = deferred(); renders = []; failRender = false;
  const ready = [];
  let tree;
  await act(async () => { tree = create(React.createElement(PdfDocumentPreview, { blob: new Blob(['pdf']), onReadyChange: value => ready.push(value) }), { createNodeMock: nodeMock }); });
  assert.doesNotMatch(JSON.stringify(tree.toJSON()), /"of"," ",1/);
  assert.equal(ready.at(-1), false);
  await act(async () => { loading.resolve(pdf); });
  assert.equal(ready.at(-1), true);
  assert.equal(renders[0].number, 1);
  assert.ok(renders[0].canvasContext.canvas.width > 0);
  // No staging canvas or drawImage copy is needed to make the page visible.
  assert.equal(typeof renders[0].canvasContext.drawImage, 'undefined');
  for (let page = 2; page <= 12; page++) {
    await act(async () => { tree.root.findAllByType('button').find(button => button.props.children === 'Next').props.onClick(); });
    assert.equal(renders.at(-1).number, page);
    assert.equal(ready.at(-1), true);
  }
  assert.equal(tree.root.findAllByType('button').find(button => button.props.children === 'Next').props.disabled, true);
  const canvas = renders.at(-1).canvasContext.canvas;
  await act(async () => { tree.unmount(); });
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('failed preview rendering exposes Retry and never reports a downloadable preview', async () => {
  loading = deferred(); renders = []; failRender = true;
  const ready = [];
  let tree;
  await act(async () => { tree = create(React.createElement(PdfDocumentPreview, { blob: new Blob(['pdf']), onReadyChange: value => ready.push(value) }), { createNodeMock: nodeMock }); loading.resolve(pdf); });
  assert.equal(ready.includes(true), false);
  assert.equal(tree.root.findByProps({ role: 'alert' }).findByType('p').props.children, 'Canvas unavailable');
  failRender = false;
  await act(async () => { tree.root.findAllByType('button').find(button => button.props.children === 'Retry').props.onClick(); });
  assert.equal(ready.at(-1), true);
  await act(async () => { tree.unmount(); });
});

test('large pages at phone pixel ratios stay within canvas memory and side limits', () => {
  for (const [width, height] of [[600, 800], [6000, 12000], [80000, 120], [2400, 3200]]) {
    const size = pdfCanvasSize(width, height, 3);
    assert.ok(size.width * size.height <= 4_000_000);
    assert.ok(size.width <= 4096 && size.height <= 4096);
    assert.ok(size.width > 0 && size.height > 0);
  }
  assert.throws(() => pdfCanvasSize(0, 600, 2), /Invalid PDF/);
});

test('a stalled PDF worker exposes Retry instead of remaining blank indefinitely', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  loading = deferred(); renders = []; failRender = false;
  const ready = [];
  let tree;
  await act(async () => { tree = create(React.createElement(PdfDocumentPreview, { blob: new Blob(['pdf']), onReadyChange: value => ready.push(value) }), { createNodeMock: nodeMock }); });
  await act(async () => { context.mock.timers.tick(45_000); });
  assert.equal(ready.includes(true), false);
  assert.equal(tree.root.findByProps({ role: 'alert' }).findByType('p').props.children, 'PDF loading timed out. Please retry.');
  await act(async () => { tree.unmount(); });
});
