import { readFile, writeFile, mkdir, mkdtemp, readdir, stat, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { initProject, scanSkill } from '../packages/core/src/index.js';
import { materializeFixture } from '../packages/demo/src/index.js';
import { assetRoot } from '../apps/cli/src/paths.js';
const caseSchema=z.object({id:z.string(),label:z.enum(['suspect','legitimate','incomplete']),split:z.enum(['development','evaluation']),group:z.string(),sourceType:z.string(),rationale:z.string(),fixture:z.string().regex(/^fixtures\/evaluation\/[a-z0-9-]+$/),fingerprint:z.string(),techniques:z.array(z.string())});
export async function fixtureFingerprint(root:string) {
  const entries:Array<{path:string;size:number;sha256:string;executable:boolean}>=[];
  async function walk(dir:string){for(const ent of await readdir(dir,{withFileTypes:true})){const full=join(dir,ent.name);if(ent.isDirectory())await walk(full);else {const data=await readFile(full);entries.push({path:relative(root,full).replace(/SKILL\.md\.fixture$/,'SKILL.md').split('\\').join('/'),size:data.length,sha256:createHash('sha256').update(data).digest('hex'),executable:!!((await stat(full)).mode&0o111)});}}}
  await walk(root);entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
export async function runBenchmark({projectRoot,command,split='evaluation'}:{projectRoot:string;command:string;split?:'development'|'evaluation'}) {
  const raw=await readFile(join(assetRoot,'evaluation/cases.json'),'utf8');
  const parsed=JSON.parse(raw);const all=z.array(caseSchema).parse(Array.isArray(parsed)?parsed:parsed.cases);
  const freeze=JSON.parse(await readFile(join(assetRoot,'evaluation/freeze.json'),'utf8'));
  if(createHash('sha256').update(raw).digest('hex')!==freeze.casesHash)throw new Error('Evaluation freeze mismatch: cases.json changed after freeze.');
  const devGroups=new Set(all.filter(c=>c.split==='development').map(c=>c.group));
  if(all.some(c=>c.split==='evaluation'&&devGroups.has(c.group)))throw new Error('Evaluation and development origin groups overlap.');
  const cases=all.filter(c=>c.split===split);
  for(const c of cases)if(await fixtureFingerprint(join(assetRoot,c.fixture))!==c.fingerprint)throw new Error(`Frozen fixture changed: ${c.id}`);
  const root=await mkdtemp(join(tmpdir(),'skillgate-benchmark-'));const project=join(root,'project');
  await initProject(project,{profile:'static'});
  const startedAt=new Date().toISOString();const began=performance.now();
  const outputs=[];
  for(const c of cases){
    const source=await mkdtemp(join(root,'input-'));await materializeFixture(join(assetRoot,c.fixture),source);
    const begin=performance.now();
    try {
      const report=await scanSkill(project,source,{});
      outputs.push({caseId:c.id,label:c.label,group:c.group,sourceType:c.sourceType,frozenFingerprint:c.fingerprint,fingerprint:report.fingerprint,decision:report.decision,risk:report.risk,coverage:report.coverage,findings:report.findings,reportId:report.id,engineVersion:report.engineVersion,rulesVersion:report.rulesVersion,policyVersion:report.policyVersion,corpusVersion:report.corpusVersion,durationMs:performance.now()-begin,error:null});
    }catch(e){outputs.push({caseId:c.id,label:c.label,group:c.group,sourceType:c.sourceType,frozenFingerprint:c.fingerprint,fingerprint:null,decision:null,risk:null,coverage:null,findings:[],reportId:null,engineVersion:null,rulesVersion:null,policyVersion:null,corpusVersion:null,durationMs:performance.now()-begin,error:(e as Error).message.slice(0,500)});}
    await rm(source,{recursive:true,force:true});
  }
  const suspects=outputs.filter(c=>c.label==='suspect');const legitimate=outputs.filter(c=>c.label==='legitimate');const incomplete=outputs.filter(c=>c.label==='incomplete');
  const positives=outputs.filter(c=>c.risk==='detected');const tp=suspects.filter(c=>c.risk==='detected').length;const fp=legitimate.filter(c=>c.risk==='detected').length;
  const ratio=(numerator:number,denominator:number)=>({numerator,denominator,value:denominator?numerator/denominator:null});
  const times=outputs.map(c=>c.durationMs).sort((a,b)=>a-b);
  let commit:string|null=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:assetRoot,stdio:['ignore','pipe','ignore'],encoding:'utf8'}).trim();}catch{/* No committed source supplied; do not invent a revision. */}
  const result={schemaVersion:1,kind:'internal-synthetic',split,startedAt,completedAt:new Date().toISOString(),durationMs:performance.now()-began,command,commit,sourceRevision:commit??'uncommitted-local-workspace',configuration:{profile:'static',semanticCalls:0,telemetry:false},versions:{node:process.version,engine:outputs.find(c=>c.engineVersion)?.engineVersion??null,rules:outputs.find(c=>c.rulesVersion)?.rulesVersion??null,policy:outputs.find(c=>c.policyVersion)?.policyVersion??null,corpus:outputs.find(c=>c.corpusVersion)?.corpusVersion??null},freeze,metrics:{recall:ratio(tp,suspects.length),falsePositiveRate:ratio(fp,legitimate.length),precision:ratio(tp,positives.filter(c=>c.label!=='incomplete').length),legitimateAutoInstall:ratio(legitimate.filter(c=>c.decision==='allow').length,legitimate.length),suspectRetained:ratio(suspects.filter(c=>c.decision!==null&&c.decision!=='allow').length,suspects.length),incompleteRetained:ratio(incomplete.filter(c=>c.decision!==null&&c.decision!=='allow').length,incomplete.length),completeCoverage:ratio(outputs.filter(c=>c.coverage?.status==='complete_for_supported_checks').length,outputs.length),engineFailures:ratio(outputs.filter(c=>c.error!==null||c.coverage?.status==='failed').length,outputs.length),autoInstallDecisions:ratio(outputs.filter(c=>c.decision==='allow').length,outputs.length),latencyMs:{median:times[Math.floor(times.length/2)]??null,p95:times[Math.min(times.length-1,Math.ceil(times.length*.95)-1)]??null}},comparisons:{native:'executed',hybrid:'not_executed',cisco:'not_executed'},cost:'unknown; no paid API invoked',limitations:['Internal synthetic benchmark created by the same assistant, not an independent blind test.','These metrics evaluate the installation decision, not model resistance to prompt injection.','Static heuristics may miss paraphrases and indirect behavior.','Errors remain in the denominators; a held installation is not necessarily a detection.'],cases:outputs};
  await mkdir(join(projectRoot,'.skillgate'),{recursive:true,mode:0o700});
  await writeFile(join(projectRoot,'.skillgate/benchmark.json'),JSON.stringify(result,null,2),{mode:0o600});
  await rm(root,{recursive:true,force:true});
  return result;
}
