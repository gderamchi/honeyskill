import { build } from 'esbuild';
import { mkdir, cp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const root = new URL('../', import.meta.url);
process.chdir(fileURLToPath(root));
const manifest=JSON.parse(await readFile('package.json','utf8'));
for (const name of ['good', 'trap']) await readFile(`packages/skillguard-lite/lab-fixtures/${name}/SKILL.md.fixture`);
await rm('dist',{recursive:true,force:true});
await mkdir('dist', {recursive:true});
const result=await build({entryPoints:['apps/cli/src/index.ts'], bundle:true, platform:'node', target:'node22',format:'esm',outfile:'dist/cli.js',banner:{js:'#!/usr/bin/env node\nimport { createRequire as __sgCreateRequire } from "node:module"; const require = __sgCreateRequire(import.meta.url);'}, sourcemap:true,metafile:true});
for(const path of ['research','fixtures','evaluation/cases.json','evaluation/freeze.json','public-demo']) {
  await cp(path, `dist/${path}`, {recursive:true});
}
await mkdir('dist/assets/honeyskill', { recursive: true });
await cp('assets/honeyskill/logo.png', 'dist/assets/honeyskill/logo.png');
await cp('packages/skillguard-lite/data', 'dist/skillguard-lite/data', { recursive: true });
for (const name of ['good', 'trap']) {
  await mkdir(`dist/lab-skills/${name}`, { recursive: true });
  await cp(`packages/skillguard-lite/lab-fixtures/${name}/SKILL.md.fixture`, `dist/lab-skills/${name}/SKILL.md.fixture`);
}
let notices='HoneySkill — bundled third-party licenses\n';
// The Progent checker is an attributed source port, not an npm dependency, so
// esbuild's dependency-package traversal cannot discover its required notice.
notices += `\n\n${await readFile('packages/security-policy/PROGENT_LICENSE.txt', 'utf8')}\n`;
const packages = new Map();
const directories = new Map();
async function owningPackage(directory) {
  if (directories.has(directory)) return directories.get(directory);
  let found;
  try {
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    if (pkg.name && pkg.version) found = { directory, pkg };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!found && dirname(directory) !== directory) found = await owningPackage(dirname(directory));
  directories.set(directory, found);
  return found;
}
// Trace emitted modules, including transitive and scoped dependencies, instead of maintaining a hand-picked list.
for (const output of Object.values(result.metafile.outputs)) {
  for (const [input, contribution] of Object.entries(output.inputs)) {
    if (!input.includes('node_modules/') || contribution.bytesInOutput === 0) continue;
    const found = await owningPackage(dirname(resolve(input)));
    if (!found || !found.directory.includes('/node_modules/')) throw new Error(`Cannot identify the bundled dependency for ${input}`);
    packages.set(`${found.pkg.name}@${found.pkg.version}`, found);
  }
}
for (const [name, { directory, pkg }] of [...packages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const files = (await readdir(directory)).filter(file => /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(file)).sort();
  if (!files.length) throw new Error(`Bundled dependency ${name} has no license file; its notice must be resolved before packaging.`);
  notices += `\n\n${name} (${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? 'unspecified')})\n`;
  for (const file of files) {
    notices += `\n--- ${file} ---\n${await readFile(join(directory, file), 'utf8')}\n`;
  }
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt',notices.trimEnd()+'\n');
await cp('README.md','dist/README.md');
await cp('README-SKILLGATE-HISTORY.md','dist/README-SKILLGATE-HISTORY.md');
await writeFile('dist/package.json', JSON.stringify({name:manifest.name,version:manifest.version,description:'Agent-skill inspection and financial-action mediation in an isolated laboratory.',type:'module',bin:{honeyskill:'cli.js',skillgate:'cli.js'},engines:manifest.engines,repository:{type:'git',url:'https://github.com/gderamchi/honeyskill.git'},homepage:'https://github.com/gderamchi/honeyskill',files:['cli.js','cli.js.map','research','fixtures','evaluation','skillguard-lite','lab-skills','public-demo','assets/honeyskill/logo.png','README.md','README-SKILLGATE-HISTORY.md','THIRD_PARTY_NOTICES.txt'],license:'UNLICENSED'},null,2));
console.log(`HoneySkill ${manifest.version}: CLI, lab examples and behavioral data bundled into dist/ (${packages.size} dependency notices; no web server or UI).`);
