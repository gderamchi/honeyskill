import { mkdtemp, mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { addSkill, initProject, updateSkill, installScan } from '../../core/src/index.js';
import { assetRoot } from '../../../apps/cli/src/paths.js';

const actionSchema=z.discriminatedUnion('method',[
  z.object({method:z.literal('read'),account:z.literal('demo-user')}).strict(),
  z.object({method:z.literal('transfer'),from:z.literal('demo-user'),to:z.literal('demo-external'),amount:z.number().int().positive().max(100),asset:z.literal('DEMOUSD')}).strict()
]);
export async function materializeFixture(source:string,destination:string):Promise<void> {
  await mkdir(destination,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})) {
    if(entry.isSymbolicLink())throw new Error('Fixture symlink refused');
    const target=join(destination,entry.name==='SKILL.md.fixture'?'SKILL.md':entry.name);
    if(entry.isDirectory())await materializeFixture(join(source,entry.name),target);
    else if(entry.isFile())await copyFile(join(source,entry.name),target);
    else throw new Error('Fixture special file refused');
  }
}
export async function replayLedger(skillPath:string) {
  const ledger={'demo-user':100,'demo-external':0};
  const trace:Array<{method:string;detail:string}>=[];
  let actions:z.infer<typeof actionSchema>[]=[];
  try {actions=z.object({actions:z.array(actionSchema).max(10)}).strict().parse(JSON.parse(await readFile(join(skillPath,'actions.json'),'utf8'))).actions;}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {available:false,ledger,trace};throw e;}
  for(const action of actions){
    if(action.method==='read')trace.push({method:'read',detail:`${action.account}: ${ledger[action.account]} DEMOUSD`});
    else {if(ledger[action.from]<action.amount)throw new Error('Insufficient fictitious balance');ledger[action.from]-=action.amount;ledger[action.to]+=action.amount;trace.push({method:'transfer',detail:`${action.amount} DEMOUSD → ${action.to}`});}
  }
  return {available:true,ledger,trace};
}
export async function runDemo() {
  const root=await mkdtemp(join(tmpdir(),'skillgate-demo-'));
  const protectedProject=join(root,'protected');const exceptionProject=join(root,'exception');
  const source=join(root,'source');const bad=join(root,'suspect');
  await materializeFixture(join(assetRoot,'fixtures/portfolio-legitimate'),source);
  await materializeFixture(join(assetRoot,'fixtures/portfolio-suspicious'),bad);
  await initProject(protectedProject,{profile:'static'});
  await initProject(exceptionProject,{profile:'static'});
  const baseline=await replayLedger(bad);
  const blocked=await addSkill(protectedProject,bad,{});
  const blockedLedger=await replayLedger(join(protectedProject,'.agents/skills/portfolio-summary'));
  const legitimate=await addSkill(protectedProject,source,{});
  const legitimateLedger=await replayLedger(join(protectedProject,'.agents/skills/portfolio-summary'));
  await materializeFixture(join(assetRoot,'fixtures/portfolio-suspicious'),source);
  const update=await updateSkill(protectedProject,'portfolio-summary');
  const afterUpdate=await replayLedger(join(protectedProject,'.agents/skills/portfolio-summary'));
  const exceptionScan=await addSkill(exceptionProject,bad,{});
  const r=exceptionScan.report;
  const exception=await installScan(exceptionProject,r.id,{fingerprint:r.fingerprint,destination:join(exceptionProject,'.agents/skills',r.name),confirmation:`INSTALL ${r.id} ${r.fingerprint}`,operator:'synthetic-demo-operator',reason:'Explicit exception only inside isolated deterministic demonstration.'});
  const afterException=await replayLedger(join(exceptionProject,'.agents/skills/portfolio-summary'));
  const result={schemaVersion:1,executedAt:new Date().toISOString(),mode:'deterministic simulation, not a measurement of model behavior',root,protectedProject,exceptionProject,realFunds:false,networkCalls:0,baseline,protected:{reportId:blocked.report.id,decision:blocked.report.decision,installed:!!blocked.installation,execution:blockedLedger},legitimate:{reportId:legitimate.report.id,decision:legitimate.report.decision,installed:!!legitimate.installation,execution:legitimateLedger},update:{reportId:update.report.id,decision:update.report.decision,installed:!!update.installation,previousFingerprint:legitimate.installation?.fingerprint,execution:afterUpdate},exception:{record:exception,execution:afterException}};
  await writeFile(join(root,'demo-result.json'),JSON.stringify(result,null,2));
  return result;
}
