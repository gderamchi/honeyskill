import { build } from 'esbuild';
import { mkdir, cp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
process.chdir(fileURLToPath(root));
const manifest=JSON.parse(await readFile('package.json','utf8'));
await rm('dist',{recursive:true,force:true});
await mkdir('dist', {recursive:true});
await build({entryPoints:['apps/cli/src/index.ts'], bundle:true, platform:'node', target:'node22',format:'esm',outfile:'dist/cli.js',banner:{js:'#!/usr/bin/env node\nimport { createRequire as __sgCreateRequire } from "node:module"; const require = __sgCreateRequire(import.meta.url);'}, sourcemap:true});
for(const path of ['research','fixtures','evaluation/cases.json','evaluation/freeze.json']) {
  await cp(path, `dist/${path}`, {recursive:true});
}
let notices='SkillGate Finance — bundled third-party licenses\n';
for(const dir of await readdir('node_modules/.pnpm')) {
  const name=dir.split('@')[0];
  if(!['zod','yaml','commander'].includes(name))continue;
  const base=`node_modules/.pnpm/${dir}/node_modules/${name}`;
  const pkg=JSON.parse(await readFile(`${base}/package.json`,'utf8'));
  for(const file of ['LICENSE','LICENSE.md','LICENSE.txt']) {
    try {notices+=`\n\n${pkg.name}@${pkg.version} (${pkg.license})\n${await readFile(`${base}/${file}`,'utf8')}`;break;}catch{}
  }
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt',notices);
await cp('README.md','dist/README.md');
await writeFile('dist/package.json', JSON.stringify({name:manifest.name,version:manifest.version,description:'Financial-risk checks before agent skill installation. Local CLI prototype.',type:'module',bin:{skillgate:'cli.js'},engines:manifest.engines,repository:{type:'git',url:'https://github.com/gderamchi/skillgate.git'},homepage:'https://github.com/gderamchi/skillgate',files:['cli.js','cli.js.map','research','fixtures','evaluation','README.md','THIRD_PARTY_NOTICES.txt'],license:'UNLICENSED'},null,2));
console.log(`SkillGate ${manifest.version}: CLI and research bundled into dist/ (no web server or UI).`);
