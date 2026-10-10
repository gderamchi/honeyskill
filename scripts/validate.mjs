import { spawnSync } from 'node:child_process';
import { mkdir,writeFile,readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
await mkdir('outputs',{recursive:true});
const commands=[['pnpm',['typecheck']],['pnpm',['test']],['pnpm',['build']],['python3',['scripts/cli-pty-smoke.py']],['node',['dist/cli.js','demo','--json']],['pnpm',['pack:local']],['pnpm',['smoke:package']]];
const entries=[];
for(const [binary,args] of commands){
  const command=[binary,...args].join(' '),startedAt=new Date().toISOString(),started=performance.now();
  const result=spawnSync(binary,args,{encoding:'utf8',maxBuffer:10*1024*1024,timeout:120000,env:{...process.env,NO_COLOR:'1',OPENAI_API_KEY:''}});
  const file=`outputs/cli-validation-${entries.length+1}.log`;
  await writeFile(file,`$ ${command}\n${result.stdout??''}${result.stderr??''}`);
  entries.push({command,startedAt,completedAt:new Date().toISOString(),durationMs:performance.now()-started,exitCode:result.status,log:file,error:result.error?.message??null});
  console.log(`${result.status===0?'PASS':'FAIL'} ${command}`);
  if(binary==='node'&&args.includes('demo')&&result.status===0)await writeFile('outputs/cli-demo.json',result.stdout);
  if(result.status!==0){await writeFile('outputs/cli-validation.json',JSON.stringify({entries},null,2));process.exit(1);}
}
const manifest=[];
async function digest(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(['dist','node_modules'].includes(entry.name))continue;if(entry.isDirectory())await digest(file);else if(/\.(ts|tsx|mjs|json|css|html|py)$/.test(file)){const data=await readFile(file);manifest.push({file,sha256:createHash('sha256').update(data).digest('hex')});}}}
for(const dir of ['apps','packages','scripts','research','evaluation','tests'])await digest(dir);
for(const file of ['package.json','pnpm-lock.yaml','tsconfig.json','playwright.config.ts'])manifest.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
manifest.sort((a,b)=>a.file.localeCompare(b.file));
const result={completedAt:new Date().toISOString(),status:'passed',node:process.version,commit:null,commitReason:'Directory initially not a Git repository; no commit fabricated.',sourceDigest:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),sourceManifest:manifest,paidApiCalls:0,entries};
await writeFile('outputs/cli-validation.json',JSON.stringify(result,null,2));
