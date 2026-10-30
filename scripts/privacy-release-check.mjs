import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const policySource = await readFile(new URL('../src/lib/privacyNotice.ts', import.meta.url), 'utf8');
const policyCode = ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const policyUrl = `data:text/javascript;base64,${Buffer.from(policyCode).toString('base64')}`;
const source = await readFile(new URL('../src/lib/privacyClosure.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('"./privacyNotice"', JSON.stringify(policyUrl));
const { privacyClosure } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

// This checks evidence completeness; it is not an automatic legal compliance certificate.
try {
  const path = process.env.PRIVACY_EVIDENCE_FILE || new URL('../compliance/evidence.json', import.meta.url);
  const record = JSON.parse(await readFile(path, 'utf8'));
  const rows = privacyClosure(record.evidence || {});
  for (const row of rows) console.log(`${row.readyForReview ? 'READY FOR SIGN-OFF' : 'OPEN'}: ${row.name}${row.missing.length ? ` — ${row.missing.join(', ')}` : ''}`);
  const complete = rows.filter((row) => row.readyForReview).length;
  console.log(`${complete}/10 requirements have the required configuration and referenced evidence. A responsible officer must verify the evidence and sign off.`);
  if (complete !== 10) process.exitCode = 1;
} catch {
  console.error('Cannot check privacy evidence. Provide the expected JSON/configuration; no evidence contents or secrets are printed.');
  process.exitCode = 1;
}
