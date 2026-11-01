// Generate reproducible public policy snapshots and a PDF-authoring payload. No production secrets are loaded.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {}; cache.set(file, exports);
  new Function('exports','require',compiled)(exports, name => {
    if (!name.startsWith('.')) throw new Error('Only local policy modules may be loaded');
    return load(path.resolve(path.dirname(file), name+'.ts'));
  });
  return exports;
}
const policies=load('src/lib/legalPolicies.ts');
const {LEGAL_POLICY_VERSION,LEGAL_POLICY_DATE}=load('src/lib/legalVersion.ts');
const privacy=load('src/lib/privacyNotice.ts').privacyNotice({});
const snapshot={version:LEGAL_POLICY_VERSION,date:LEGAL_POLICY_DATE,operator:privacy.organisation,...policies};
fs.mkdirSync('docs/privacy/versions',{recursive:true});
const jsonPath=`docs/privacy/versions/${LEGAL_POLICY_VERSION}.json`;
if(fs.existsSync(jsonPath)&&fs.readFileSync(jsonPath,'utf8')!==JSON.stringify(snapshot,null,2)+'\n')throw new Error('Refusing to alter an existing contractual snapshot');
fs.writeFileSync(jsonPath,JSON.stringify(snapshot,null,2)+'\n');
const escape = text => text.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NovaQuill terms and policies ${LEGAL_POLICY_VERSION}</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:880px;margin:auto;padding:24px;color:#202020}h1,h2,h3{line-height:1.3}section{margin:32px 0}p{overflow-wrap:anywhere}a{color:#075e79}@media print{nav{display:none}}</style><h1>NovaQuill - Terms and policies / Termos e políticas</h1><p>${LEGAL_POLICY_DATE} · ${LEGAL_POLICY_VERSION}</p><p>ARTOBYTE · 2024/359197/07<br>8 Malgas Street, Birch Acres, Kempton Park, Gauteng, 1618, South Africa<br>info@artobyte.com · +27 68 497 1592</p><nav><a href="#en">English</a> · <a href="#pt">Português</a></nav>`;
for(const locale of ['en','pt']) {
 html+=`<article id="${locale}" lang="${locale}"><h2>${locale==='en'?'English':'Português'}</h2>`;
 for(const [key,titles] of [['termsSections',['Terms of Service','Termos de Serviço']],['subscriptionSections',['Subscriptions and refunds','Subscrições e reembolsos']],['browserStorageSections',['Cookies and storage','Cookies e armazenamento']]]) {
  html+=`<section><h2>${titles[locale==='pt'?1:0]}</h2>`;
  for(const s of snapshot[key])html+=`<h3>${escape(s[locale==='pt'?'headingPt':'heading'])}</h3><p>${escape(s[locale==='pt'?'bodyPt':'body'])}</p>`;
  html+='</section>';
 }
 html+='</article>';
}
html+='</html>';fs.mkdirSync('public/legal',{recursive:true});fs.writeFileSync(`public/legal/${LEGAL_POLICY_VERSION}.html`,html);
const ast=ts.createSourceFile('paia.tsx',fs.readFileSync('src/app/paia/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let paiaSections=[];
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='sections'&&ts.isConditionalExpression(node.initializer)){paiaSections=node.initializer.whenFalse.elements.map(row=>row.elements.map(cell=>cell.text));}ts.forEachChild(node,visit);}
visit(ast);
if(paiaSections.length!==12)throw new Error('PAIA source extraction requires review');
fs.mkdirSync('tmp/pdfs',{recursive:true});fs.writeFileSync('tmp/pdfs/policy-payload.json',JSON.stringify({snapshot,privacy,paiaSections},null,2));
console.log(`Exported ${LEGAL_POLICY_VERSION}; ${paiaSections.length} PAIA sections`);
