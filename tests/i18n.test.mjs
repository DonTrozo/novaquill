import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/i18n.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('"./translations"', JSON.stringify(new URL('../src/lib/translations.ts', import.meta.url).href));
const { preferredLocale, localeFromHeader, createTranslator } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('phone language variants select Portuguese automatically', () => {
  for (const locale of ['pt', 'pt-AO', 'pt-PT', 'pt-BR', 'PT-ao', 'pt_MZ']) {
    assert.equal(preferredLocale([locale, 'en-US']), 'pt');
  }
  assert.equal(preferredLocale(['en-ZA', 'pt-AO']), 'en');
  assert.equal(preferredLocale(['fr-FR', 'pt-AO', 'en-US']), 'pt');
  assert.equal(preferredLocale([]), 'en');
  assert.equal(preferredLocale(['de-DE']), 'en');
});

test('first server render respects weighted browser preferences and excludes rejected languages', () => {
  assert.equal(localeFromHeader('pt-AO,pt;q=0.9,en-US;q=0.8,en;q=0.7'), 'pt');
  assert.equal(localeFromHeader('en;q=0.3,pt-PT;q=0.9'), 'pt');
  assert.equal(localeFromHeader('en-ZA,en;q=0.9,pt;q=0.8'), 'en');
  assert.equal(localeFromHeader('pt;q=0,en;q=1'), 'en');
  assert.equal(localeFromHeader('pt;q=invalid,en;q=0.9'), 'en');
  assert.equal(localeFromHeader(null), 'en');
});

test('upload, signing, preview, account and recent editing tools all have Portuguese copy', () => {
  const t = createTranslator('pt');
  for (const label of ['Upload PDF', 'Sign', 'Done signing', 'Finish & Preview', 'Sign in & Download', 'Download Signed PDF', 'Log in', 'Pricing', 'Dashboard', 'Delete signature', 'Rotate signature freely', 'Text font size in points']) {
    assert.notEqual(t(label), label, label);
  }
  assert.equal(t('Upload PDF'), 'Carregar PDF');
  assert.equal(t('{remaining} of {limit} free documents remaining this month.', { remaining: 1, limit: 3 }), 'Restam 1 de 3 documentos gratuitos este mês.');
});

test('English fallback and user-supplied interpolation stay intact', () => {
  const english = createTranslator('en'), portuguese = createTranslator('pt');
  assert.equal(english('Upload PDF'), 'Upload PDF');
  assert.equal(portuguese('Unrecognised external error'), 'Unrecognised external error');
  assert.equal(portuguese('Use saved signature {name}', { name: 'Download {name} <João>' }), 'Utilizar a assinatura guardada Download {name} <João>');
});
