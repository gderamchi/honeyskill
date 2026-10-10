import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { initProject, loadConfig, scanSkill, addSkill, updateSkill, listInstalls, listReports, readReport, installScan, exceptionConfirmation, sanitizeTerminal, OpenAIResponsesProvider, pruneData, type AddResult } from '../../../packages/core/src/index.js';
import type { ScanReport } from '../../../packages/contracts/src/index.js';
import packageJson from '../../../package.json' with { type: 'json' };
import { question, reportText } from './interaction.js';
import { reportHtml } from './report.js';
import { runDemo } from '../../../packages/demo/src/index.js';
import { runBenchmark } from '../../../evaluation/runner.js';
import { prepareTerminal, envScript, dispatchTerminal, terminalCommands, terminalStatus, type TerminalCommand } from './terminal.js';
import { prepareCodexHook, processHook } from './codex-hook.js';
import { startProtectedSession } from './session.js';

const scope = 'Contrôle des installations SkillGate et des installateurs pris en charge dans le terminal activé. Cible : Codex, .agents/skills du projet. Copies manuelles et contournements du PATH hors périmètre.';
const program=new Command().name('skillgate').description('Prévention des risques financiers avant installation de skills.').version(packageJson.version);
program.option('--project <directory>','Racine du projet',process.cwd()).option('--json','Sortie JSON uniquement sur stdout');
program.configureOutput({writeErr:s=>process.stderr.write(sanitizeTerminal(s)),outputError:(s,write)=>write(sanitizeTerminal(s))});
const root=()=>resolve(program.opts().project);
const machine=()=>Boolean(program.opts().json);
const interactive=()=>!machine() && Boolean(process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY);
function emit(data:unknown,text?:string){process.stdout.write(machine()||!text?JSON.stringify(data,null,2)+'\n':sanitizeTerminal(text)+'\n');}
async function configured(){
  try{return await loadConfig(root());}
  catch(e){
    if(!['ENOENT','NOT_INITIALIZED'].includes((e as NodeJS.ErrnoException).code??''))throw e;
    if(!interactive()){const error=new Error('Configuration absente. Exécutez skillgate init --agent codex --profile static.');Object.assign(error,{exitCode:3});throw error;}
    process.stderr.write(scope+'\n');
    const answer=await question(`Configurer Codex pour ce projet (${root()}) avec Analyse statique locale ? [O/n] `);
    if(answer.trim() && !['o','oui','y','yes'].includes(answer.trim().toLowerCase()))throw Object.assign(new Error('Configuration annulée.'),{exitCode:130});
    return initProject(root(),{profile:'static'});
  }
}
async function chooseInstallation(report:ScanReport,reason?:string){
  if(!interactive())throw Object.assign(new Error('Décision humaine requise dans un terminal interactif, sans --json. Aucun --yes n’accepte le risque.'),{exitCode:2});
  const config=await loadConfig(root());
  const destination=join(root(),config.target,report.name);
  process.stderr.write(sanitizeTerminal(`${reportText(report)}\nDestination exacte : ${destination}\n\n[1] Ne pas installer (défaut)\n[2] Installer malgré le risque\n`));
  const choice=await question('Votre choix [1/2] : ');
  if(choice.trim()!=='2')return undefined;
  return installScan(root(),report.id,{fingerprint:report.fingerprint,destination,confirmation:exceptionConfirmation(report),operator:userInfo().username,...(reason?{reason}:{})});
}
async function finishInstallation(result:AddResult){
  if(!result.installation && interactive()){
    const installation=await chooseInstallation(result.report);
    if(installation){emit({...result,installation},`Installé avec exception : ${result.report.name}. Les alertes restent dans le rapport ${result.report.id}.`);return;}
    emit({...result,cancelled:true},'Installation annulée ; paquet retenu.');
  }else emit(result,reportText(result.report,result.installation));
  if(!result.installation)process.exitCode=2;
}
function installedEntry(){
  const entry=fileURLToPath(import.meta.url);
  if(!entry.endsWith('.js'))throw new Error('L’activation nécessite le CLI compilé : pnpm build:cli, puis node dist/cli.js on.');
  return entry;
}
program.command('on').description('Ouvrir un terminal protégé ; quitter avec exit.').action(async()=>{
  process.exitCode=await startProtectedSession(root(),installedEntry(),{json:machine(),nodePath:process.execPath});
});
program.command('enable').description('Configurer le contrôle du terminal ; activer avec eval "$(skillgate enable)".').option('--agent <agent>','Agent cible','codex').option('--codex-hook','Ajouter le hook Codex complémentaire (revue /hooks nécessaire)').action(async options=>{
  if(options.agent!=='codex')throw new Error('Seule la cible Codex projet est prise en charge.');
  const cli=installedEntry();
  await initProject(root(),{});
  const terminal=await prepareTerminal(root(),cli,process.execPath);
  const hook=options.codexHook?await prepareCodexHook(root(),cli,process.execPath):undefined;
  if(machine())emit({terminal,hook,activation:'eval "$(skillgate env)"',scope});
  else{
    process.stderr.write(sanitizeTerminal(`SkillGate configuré pour ${root()}. Appliquez ces exports dans ce terminal avec eval "$(skillgate enable)".\n${hook?'Hook Codex configuré : ouvrez /hooks dans Codex pour le revoir et l’autoriser.\n':''}`));
    process.stdout.write(await envScript(root()));
  }
});
program.command('env').description('Afficher les exports shell du projet configuré.').action(async()=>{
  if(machine())throw new Error('env produit des exports shell, pas du JSON.');
  process.stdout.write(await envScript(root()));
});
program.command('terminal-dispatch',{hidden:true}).requiredOption('--command <name>').argument('[args...]').allowUnknownOption().action(async(args:string[],options)=>{
  if(!terminalCommands.includes(options.command))throw new Error('Installateur terminal inconnu.');
  process.exitCode=await dispatchTerminal(root(),options.command as TerminalCommand,args);
});
program.command('hook',{hidden:true}).action(async()=>{
  // Always return a native deny envelope on invalid input; ordinary CLI errors are not valid hook output.
  try{
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of process.stdin){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>256*1024)throw new Error('Entrée du hook trop volumineuse.');chunks.push(bytes);}
    const result=processHook(JSON.parse(Buffer.concat(chunks).toString('utf8')),root(),installedEntry(),process.execPath);
    if(result)process.stdout.write(JSON.stringify(result)+'\n');
  }catch{
    process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'SkillGate : entrée du hook invalide ; installation refusée.'}})+'\n');
  }
});
program.command('init').option('--agent <agent>','Cible','codex').option('--profile <profile>','static ou hybrid (défaut initial : static)').option('--semantic-consent','Autoriser l’envoi du contenu expurgé à OpenAI (API payante)').option('--model <model>','Modèle explicitement choisi').option('--retention-days <days>','Conservation des rapports inactifs (défaut initial : 30)').action(async(options)=>{
  if(options.agent!=='codex'||(options.profile&&!['static','hybrid'].includes(options.profile)))throw new Error('Cible codex et profil static ou hybrid requis.');
  if(options.profile==='hybrid'&&options.semanticConsent&&!options.model)throw new Error('Spécifiez --model pour un envoi sémantique consenti.');
  const config=await initProject(root(),{...(options.profile?{profile:options.profile}:{}),...(options.semanticConsent!==undefined?{semanticConsent:!!options.semanticConsent}:{}),...(options.model?{model:options.model}:{}),...(options.retentionDays?{retentionDays:Number(options.retentionDays)}:{})});
  emit(config,`Configuration locale : ${join(root(),'.skillgate/config.json')}\nDestination : ${join(root(),config.target)}\nProfil : ${config.profile==='static'?'Analyse statique':'Analyse hybride'}\n${scope}`);
});
for(const name of ['scan','add'] as const){
const command=program.command(`${name} <source>`).option('--skill <name>','Sélection explicite d’un skill');
if(name==='add')command.alias('install');
command.action(async(source,options)=>{
  const config=await configured();
  const provider=config.profile==='hybrid'&&config.semanticConsent&&process.env.OPENAI_API_KEY?new OpenAIResponsesProvider(process.env.OPENAI_API_KEY):undefined;
  if(name==='scan'){const report=await scanSkill(root(),source,{skill:options.skill,provider});emit(report,reportText(report));if(report.decision!=='allow')process.exitCode=2;}
  else await finishInstallation(await addSkill(root(),source,{skill:options.skill,provider}));
});}
program.command('update <name>').action(async name=>{const config=await configured();const provider=config.profile==='hybrid'&&config.semanticConsent&&process.env.OPENAI_API_KEY?new OpenAIResponsesProvider(process.env.OPENAI_API_KEY):undefined;await finishInstallation(await updateSkill(root(),name,{provider}));});
program.command('list').action(async()=>{await configured();const records=await listInstalls(root());emit(records,records.length?records.map(r=>`${r.name} · ${r.status} · ${r.fingerprint.slice(0,12)} · ${r.scanId}`).join('\n'):'Aucun skill installé par SkillGate.');});
program.command('inspect <scan-id>').action(async id=>{const report=await readReport(root(),id);emit(report,reportText(report));});
program.command('report <scan-id>').option('--format <format>','json ou html','json').option('--output <file>','Fichier de sortie').action(async(id,options)=>{
  if(!['json','html'].includes(options.format))throw new Error('Format attendu : json ou html.');
  const r=await readReport(root(),id);const content=options.format==='html'?reportHtml(r):JSON.stringify(r,null,2);
  if(options.output){await writeFile(resolve(options.output),content,{mode:0o600});emit({output:resolve(options.output)},`Rapport exporté : ${resolve(options.output)}`);}else process.stdout.write(content+'\n');
});
program.command('approve <scan-id>').option('--reason <reason>','Motif de l’exception').action(async(id,options)=>{
  await configured();const report=await readReport(root(),id);const result=await chooseInstallation(report,options.reason);
  if(!result){emit({cancelled:true},'Installation annulée ; paquet retenu.');process.exitCode=2;return;}
  emit(result,`Installé avec exception : ${report.name}. L’alerte reste dans le rapport ${id}.`);
});
program.command('doctor').action(async()=>{const config=await configured();const records=await listInstalls(root());const terminal=await terminalStatus(root());emit({node:process.version,agent:config.agent,profile:config.profile,target:join(root(),config.target),managedInstalls:records.length,terminal,codexHookTrust:'not_probed',scope,semanticConsent:config.semanticConsent,semanticExecution:'not_probed',telemetry:false},`Codex · ${config.profile==='static'?'Analyse statique':'Analyse hybride'}\n${records.length} installation(s) gérée(s).\nTerminal : ${terminal.active?'actif':terminal.configured?'configuré, activation à vérifier dans le terminal':'non configuré'}.\n${scope}\nAucune télémétrie. Confiance du hook Codex non vérifiée.`);});
program.command('demo').action(async()=>{const result=await runDemo();emit(result);});
program.command('benchmark').action(async()=>{await configured();const result=await runBenchmark({projectRoot:root(),command:process.argv.join(' ')});emit(result);});
program.command('prune').description('Supprimer les rapports et paquets inactifs au-delà de la rétention configurée.').action(async()=>{await configured();const result=await pruneData(root());emit(result);});
program.command('export').description('Exporter configuration et rapports locaux ; les snapshots sont exclus.').action(async()=>{const config=await configured();emit({config,reports:await listReports(root()),installations:await listInstalls(root())});});
program.exitOverride();
try{await program.parseAsync();}catch(error){
  const err=error as Error & {exitCode?:number;code?:string};
  if(err.code==='commander.helpDisplayed'||err.code==='commander.version')process.exitCode=0;
  else{const message=sanitizeTerminal(err.message).slice(0,1000);if(machine())process.stdout.write(JSON.stringify({error:message,code:err.code??'ERROR'})+'\n');else process.stderr.write(message+'\n');process.exitCode=err.exitCode??1;}
}
