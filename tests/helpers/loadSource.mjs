import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

// Execute the real route source with explicit boundary doubles, without a live account or database.
export async function loadSource(path, stubs = {}) {
  const key = randomUUID();
  globalThis.__novaSecurityTestModules ??= {};
  globalThis.__novaSecurityTestModules[key] = stubs;
  const modules = Object.fromEntries(Object.entries(stubs).map(([specifier, exports]) => {
    const source = Object.keys(exports).map((name) => `${name === "default" ? "export default" : `export const ${name} =`} globalThis.__novaSecurityTestModules[${JSON.stringify(key)}][${JSON.stringify(specifier)}][${JSON.stringify(name)}];`).join('\n');
    return [specifier, `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`];
  }));
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from (["'])([^"']+)\1/g, (match, quote, specifier) => modules[specifier] ? `from ${JSON.stringify(modules[specifier])}` : match);
  return import(`data:text/javascript;base64,${Buffer.from(compiled + `\n// ${key}`).toString('base64')}`);
}
