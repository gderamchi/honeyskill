import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { initProject, loadConfig, fullPipelineComplete, scanSkill, addSkill, updateSkill, listInstalls, listReports, readReport, installScan, exceptionConfirmation, sanitizeTerminal, OpenAIResponsesProvider, pruneData, type AddResult } from '../../../packages/core/src/index.js';
import type { ScanReport } from '../../../packages/contracts/src/index.js';
import packageJson from '../../../package.json' with { type: 'json' };
import { question, reportText } from './interaction.js';
import { reportHtml } from './report.js';
import { runDemo } from '../../../packages/demo/src/index.js';
import { runBenchmark } from '../../../evaluation/runner.js';
import { prepareTerminal, envScript, dispatchTerminal, terminalCommands, terminalStatus, type TerminalCommand } from './terminal.js';
import { prepareCodexHook, processHook, pinCliRuntime, codexHookStatus } from './codex-hook.js';
import { startProtectedSession } from './session.js';
import { labStatus, tryInstallation } from './lab.js';
import { fullReportHtml, fullReportTerminal } from './full-report.js';
import { registerSecurityCommands } from './security.js';

const scope = 'Checks HoneySkill installations, supported installers called by Codex with the trusted project hook, and supported installers in an activated terminal. Target: the project .agents/skills directory. Manual copies, other agents and disabled/untrusted hooks are outside this scope.';
const program=new Command().name('honeyskill').description('Inspect agent skills and mediate financial actions in an isolated laboratory.').version(packageJson.version);
program.option('--project <directory>','Project root',process.cwd()).option('--json','JSON output only on stdout');
registerSecurityCommands(program);
program.configureOutput({writeErr:s=>process.stderr.write(sanitizeTerminal(s)),outputError:(s,write)=>write(sanitizeTerminal(s))});
const root=()=>resolve(program.opts().project);
const machine=()=>Boolean(program.opts().json);
const interactive=()=>!machine() && Boolean(process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY);
function emit(data:unknown,text?:string){process.stdout.write(machine()||!text?JSON.stringify(data,null,2)+'\n':sanitizeTerminal(text)+'\n');}
program.command('lab').description('Create/check an isolated test lab (no model calls).').option('--lab <directory>','Dedicated lab directory (default: ./honeyskill-lab; reuses an existing legacy lab)').action(async options=>{
  const status=await labStatus(options.lab);
  emit(status,`Lab: ${status.root}\nModel: ${status.model}\nAnvil: ${status.anvil.available ? status.anvil.version : 'missing — install Foundry'}\nOpenAI key: ${status.apiKeyPresent ? 'available' : 'will be requested privately by try'}\nTry: honeyskill try good\nThen: honeyskill try trap\nOnly this lab can be activated. Each try uses paid API calls and disposable local funds.`);
  if(!status.anvil.available)process.exitCode=3;
});
program.command('try <source>').description('Try a skill in the lab: regex + LLM + execution + security report. Sources: good, trap, local folder, GitHub URL or owner/repo.').option('--lab <directory>','Dedicated lab directory (default: ./honeyskill-lab; reuses an existing legacy lab)').option('--skill <name>','Select a skill from a multi-skill repository').action(async(source,options)=>{
  const result=await tryInstallation(source,{...options,json:machine(),interactive:interactive()});
  emit(result,result.installation ? `${result.installation.status==='installed_with_exception'?'Installed with exception; risks remain':'Installed automatically after all three checks'}: ${result.report.name}\nLab only: ${result.lab}\nSecurity report: ${result.reports.html}` : `${result.status==='unverified'?'UNVERIFIED: required checks or coverage are incomplete; override is unavailable':'HELD: risk detected; skill not installed'}.\nSecurity report: ${result.reports.html}`);
  if(!result.installation)process.exitCode=result.status==='unverified'?3:2;
});
async function configured(){
  try{return await loadConfig(root());}
  catch(e){
    if(!['ENOENT','NOT_INITIALIZED'].includes((e as NodeJS.ErrnoException).code??''))throw e;
    if(!interactive()){const error=new Error('Configuration missing. Run honeyskill init --agent codex --profile static.');Object.assign(error,{exitCode:3});throw error;}
    process.stderr.write(scope+'\n');
    const answer=await question(`Configure Codex for this project (${root()}) with local static analysis? [Y/n] `);
    if(answer.trim() && !['o','oui','y','yes'].includes(answer.trim().toLowerCase()))throw Object.assign(new Error('Setup cancelled.'),{exitCode:130});
    return initProject(root(),{profile:'static'});
  }
}
async function chooseInstallation(report:ScanReport,reason?:string){
  if(!interactive())throw Object.assign(new Error('A human decision is required in an interactive terminal, without --json. No --yes flag accepts this risk.'),{exitCode:2});
  if(report.profile==='full' && (!fullPipelineComplete(report) || report.behavioral?.kind!=='actual-openai-local-fuji-fork-audit'))throw Object.assign(new Error('Required checks or coverage are incomplete; this lab report cannot be overridden.'),{exitCode:3});
  const config=await loadConfig(root());
  const destination=join(root(),config.target,report.name);
  process.stderr.write(sanitizeTerminal(`${report.profile==='full'?fullReportTerminal(report):reportText(report)}\nExact destination: ${destination}\n\n[1] Do not install (default)\n[2] Install despite the risk\n`));
  const choice=await question('Your choice [1/2]: ');
  if(choice.trim()!=='2')return undefined;
  return installScan(root(),report.id,{fingerprint:report.fingerprint,destination,confirmation:exceptionConfirmation(report),operator:userInfo().username,...(reason?{reason}:{})});
}
async function finishInstallation(result:AddResult){
  if(!result.installation && interactive()){
    const installation=await chooseInstallation(result.report);
    if(installation){emit({...result,installation},`Installed with exception: ${result.report.name}. Warnings remain in report ${result.report.id}.`);return;}
    emit({...result,cancelled:true},'Installation cancelled; package held.');
  }else emit(result,reportText(result.report,result.installation));
  if(!result.installation)process.exitCode=2;
}
function installedEntry(){
  const entry=fileURLToPath(import.meta.url);
  if(!entry.endsWith('.js'))throw new Error('Activation requires the compiled CLI: pnpm build:cli, then node dist/cli.js on.');
  return entry;
}
program.command('on').description('Open a protected terminal; leave with exit.').action(async()=>{
  process.exitCode=await startProtectedSession(root(),installedEntry(),{json:machine(),nodePath:process.execPath});
});
program.command('enable').alias('setup').description('Set up persistent Codex installation checks once per project; review /hooks once.').option('--agent <agent>','Target agent','codex').option('--codex-hook','Compatibility option: the persistent Codex hook is now always configured').option('--profile <profile>','static or hybrid (initial default: static)').option('--semantic-consent','Allow redacted content to be sent to OpenAI (paid API)').option('--model <model>','Explicitly selected semantic model').action(async options=>{
  if(options.agent!=='codex')throw new Error('Only the project Codex target is supported.');
  if(options.profile&&!['static','hybrid'].includes(options.profile))throw new Error('Persistent setup supports static or hybrid analysis; use try for the full dedicated lab pipeline.');
  if(options.profile==='hybrid'&&options.semanticConsent&&!options.model)throw new Error('Specify --model when consenting to semantic analysis.');
  const entry=installedEntry();
  const config=await initProject(root(),{...(options.profile?{profile:options.profile}:{}),...(options.semanticConsent?{semanticConsent:true}:{}),...(options.model?{model:options.model}:{})});
  if(config.profile==='full')throw new Error('Full analysis is lab-only. Use a separate agent project for persistent static or hybrid setup.');
  const cli=await pinCliRuntime(root(),entry);
  const terminal=await prepareTerminal(root(),cli,process.execPath);
  const hook=await prepareCodexHook(root(),cli,process.execPath);
  if(machine())emit({terminal,hook,runtime:cli,profile:config.profile,activation:'Open /hooks in Codex and trust this project hook once. Later Codex sessions use it automatically.',optionalTerminalActivation:'eval "$(honeyskill env)"',scope});
  else{
    process.stderr.write(sanitizeTerminal(`Persistent HoneySkill setup saved for ${root()}. Profile: ${config.profile}.\nOpen /hooks in Codex and review/trust the project hook once; restart any already open session. Future Codex sessions use it without shell activation.\nOptional shell protection: eval "$(honeyskill env)".\n${scope}\n`));
    process.stdout.write(await envScript(root()));
  }
});
program.command('env').description('Print shell exports for the configured project.').action(async()=>{
  if(machine())throw new Error('env outputs shell exports, not JSON.');
  process.stdout.write(await envScript(root()));
});
program.command('terminal-dispatch',{hidden:true}).requiredOption('--command <name>').argument('[args...]').allowUnknownOption().action(async(args:string[],options)=>{
  if(!terminalCommands.includes(options.command))throw new Error('Unknown terminal installer.');
  process.exitCode=await dispatchTerminal(root(),options.command as TerminalCommand,args);
});
program.command('hook',{hidden:true}).action(async()=>{
  // Always return a native deny envelope on invalid input; ordinary CLI errors are not valid hook output.
  try{
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of process.stdin){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>256*1024)throw new Error('Hook input is too large.');chunks.push(bytes);}
    const result=processHook(JSON.parse(Buffer.concat(chunks).toString('utf8')),root(),installedEntry(),process.execPath);
    if(result)process.stdout.write(JSON.stringify(result)+'\n');
  }catch{
    process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'HoneySkill: invalid hook input; installation denied.'}})+'\n');
  }
});
program.command('init').option('--agent <agent>','Target','codex').option('--profile <profile>','static or hybrid (initial default: static)').option('--semantic-consent','Allow redacted content to be sent to OpenAI (paid API)').option('--model <model>','Explicitly selected model').option('--retention-days <days>','Retention of inactive reports in days (initial default: 30)').action(async(options)=>{
  if(options.agent!=='codex'||(options.profile&&!['static','hybrid'].includes(options.profile)))throw new Error('The codex target and static or hybrid profile are required.');
  if(options.profile==='hybrid'&&options.semanticConsent&&!options.model)throw new Error('Specify --model when consenting to semantic analysis.');
  const config=await initProject(root(),{...(options.profile?{profile:options.profile}:{}),...(options.semanticConsent!==undefined?{semanticConsent:!!options.semanticConsent}:{}),...(options.model?{model:options.model}:{}),...(options.retentionDays?{retentionDays:Number(options.retentionDays)}:{})});
  emit(config,`Local configuration: ${join(root(),'.skillgate/config.json')}\nDestination: ${join(root(),config.target)}\nProfile: ${config.profile==='static'?'Static analysis':config.profile==='full'?'Full lab analysis':'Hybrid analysis'}\n${scope}`);
});
for(const name of ['scan','add'] as const){
const command=program.command(`${name} <source>`).option('--skill <name>','Explicit skill selection');
if(name==='add')command.alias('install');
command.action(async(source,options)=>{
  const config=await configured();
  if(config.profile==='full')throw new Error('Use honeyskill try <source> --lab <directory> to run every required stage in this lab.');
  const provider=config.profile==='hybrid'&&config.semanticConsent&&process.env.OPENAI_API_KEY?new OpenAIResponsesProvider(process.env.OPENAI_API_KEY):undefined;
  if(name==='scan'){const report=await scanSkill(root(),source,{skill:options.skill,provider});emit(report,reportText(report));if(report.decision!=='allow')process.exitCode=2;}
  else await finishInstallation(await addSkill(root(),source,{skill:options.skill,provider}));
});}
program.command('update <name>').action(async name=>{const config=await configured();if(config.profile==='full')throw new Error('Use honeyskill try <source> --lab <directory> to rescan and update every required stage.');const provider=config.profile==='hybrid'&&config.semanticConsent&&process.env.OPENAI_API_KEY?new OpenAIResponsesProvider(process.env.OPENAI_API_KEY):undefined;await finishInstallation(await updateSkill(root(),name,{provider}));});
program.command('list').action(async()=>{await configured();const records=await listInstalls(root());emit(records,records.length?records.map(r=>`${r.name} · ${r.status} · ${r.fingerprint.slice(0,12)} · ${r.scanId}`).join('\n'):'No skills installed by HoneySkill.');});
program.command('inspect <scan-id>').action(async id=>{const report=await readReport(root(),id);emit(report,report.profile==='full'?fullReportTerminal(report):reportText(report));});
program.command('report <scan-id>').option('--format <format>','json or html','json').option('--output <file>','Output file').action(async(id,options)=>{
  if(!['json','html'].includes(options.format))throw new Error('Expected format: json or html.');
  const r=await readReport(root(),id);const content=options.format==='html'?(r.profile==='full'?fullReportHtml(r):reportHtml(r)):JSON.stringify(r,null,2);
  if(options.output){await writeFile(resolve(options.output),content,{mode:0o600});emit({output:resolve(options.output)},`Report exported: ${resolve(options.output)}`);}else process.stdout.write(content+'\n');
});
program.command('approve <scan-id>').option('--reason <reason>','Reason for the exception').action(async(id,options)=>{
  await configured();const report=await readReport(root(),id);const result=await chooseInstallation(report,options.reason);
  if(!result){emit({cancelled:true},'Installation cancelled; package held.');process.exitCode=2;return;}
  emit(result,`Installed with exception: ${report.name}. The warning remains in report ${id}.`);
});
program.command('doctor').action(async()=>{const config=await configured();const records=await listInstalls(root());const terminal=await terminalStatus(root());const codexHook=await codexHookStatus(root());emit({node:process.version,agent:config.agent,profile:config.profile,target:join(root(),config.target),managedInstalls:records.length,terminal,codexHook,codexHookTrust:'not_probed',scope,semanticConsent:config.semanticConsent,semanticExecution:'not_probed',telemetry:false},`Codex · ${config.profile==='static'?'Static analysis':config.profile==='full'?'Full lab analysis':'Hybrid analysis'}\n${records.length} managed installation(s).\nCodex hook: ${codexHook.configured?'configured persistently; review trust in /hooks':'not configured; run honeyskill setup'}.\nTerminal: ${terminal.active?'active':terminal.configured?'configured; verify activation in the terminal':'not configured'}.\n${scope}\nNo telemetry. Codex hook trust has not been verified.`);});
program.command('demo').action(async()=>{const result=await runDemo();emit(result);});
program.command('benchmark').action(async()=>{await configured();const result=await runBenchmark({projectRoot:root(),command:process.argv.join(' ')});emit(result);});
program.command('prune').description('Delete inactive reports and packages older than the configured retention period.').action(async()=>{await configured();const result=await pruneData(root());emit(result);});
program.command('export').description('Export local configuration and reports; snapshots are excluded.').action(async()=>{const config=await configured();emit({config,reports:await listReports(root()),installations:await listInstalls(root())});});
program.exitOverride();
try{await program.parseAsync();}catch(error){
  const err=error as Error & {exitCode?:number;code?:string};
  if(err.code==='commander.helpDisplayed'||err.code==='commander.version')process.exitCode=0;
  else{const message=sanitizeTerminal(err.message).slice(0,1000);if(machine())process.stdout.write(JSON.stringify({error:message,code:err.code??'ERROR'})+'\n');else process.stderr.write(message+'\n');process.exitCode=err.exitCode??1;}
}
