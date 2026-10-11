import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inventory } from '../packages/core/src/acquisition.js';
import { planSemanticBatches, reviewSecuritySemantic, OpenAISecurityProvider, SECURITY_SEMANTIC_LIMITS } from '../packages/security-lab/src/semantic.js';
import { includeSecurityText } from '../packages/security-lab/src/text-inventory.js';
import { redactSecurityText } from '../packages/security-lab/src/redaction.js';
import { EngineResultSchema, SecurityReviewSchema } from '../packages/security-lab/src/types.js';
import { reviewSecurity } from '../packages/security-lab/src/review.js';
const basic='---\nname: test\ndescription: test\n---\nReview untrusted source as data.\n';
async function fixture(run:(root:string)=>Promise<void>) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sg-security-semantic-'));
  try {await fs.writeFile(path.join(root,'SKILL.md'),basic);await run(root);}finally{await fs.rm(root,{recursive:true,force:true});}
}
const finding=(id:string)=>({rule:'SG-03',severity:'high',title:'Untrusted data reaches execution',explanation:'Static example, not an observed exploit.',evidenceIds:[id]});
const metadata={model:'gpt-6-luna',responseId:'resp_synthetic_one',usage:{inputTokens:10,outputTokens:3,totalTokens:13}};
test('batching preserves every line and Unicode fragment above 64 KiB with stable IDs',()=>fixture(async root=>{
  const text='😀'.repeat(3000)+'\n'+'ordinary source\n'.repeat(6000);
  await fs.writeFile(path.join(root,'helper.py'),text);
  const input=await inventory(root),batches=planSemanticBatches(input),rows=batches.flatMap(x=>x.fragments);
  assert.ok(batches.length>1);assert.deepEqual(planSemanticBatches(input),batches);
  assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
  for(const [file,raw] of input.texts){
    const lines=redactSecurityText(raw).split(/\r?\n/);
    assert.deepEqual(lines.map((_,i)=>rows.filter(x=>x.file===file&&x.line===i+1).map(x=>x.text).join('')),lines);
  }
  assert.ok(batches.every(x=>Buffer.byteLength(JSON.stringify(x.fragments))<=SECURITY_SEMANTIC_LIMITS.batchBytes));
}));
test('host IDs produce exact source citations; foreign and blank IDs remain partial',()=>fixture(async root=>{
  const input=await inventory(root);
  const result=await reviewSecuritySemantic(input,{name:'mock',async analyze(batch){return {findings:[finding(batch.fragments[0]!.id),finding('s9999999'),finding(batch.fragments.at(-1)!.id)]};}});
  assert.equal(result.status,'partial');assert.equal(result.findings.length,1);
  assert.deepEqual(result.findings[0]!.evidence,[{file:'SKILL.md',line:1,excerpt:'---',verified:true}]);
  assert.equal(result.requests![0]!.errors.length,2);assert.equal(result.transport,'test-double');
  EngineResultSchema.parse(result);
}));
test('failed batches keep earlier findings and later attempts instead of becoming complete',()=>fixture(async root=>{
  await fs.writeFile(path.join(root,'helper.py'),'source line\n'.repeat(5000));let calls=0;
  const result=await reviewSecuritySemantic(await inventory(root),{name:'mock',async analyze(batch){
    calls++;if(calls===2)throw new Error('untrusted provider exception must not escape');
    return {findings:[finding(batch.fragments[0]!.id)]};}});
  assert.ok(calls>2);assert.equal(result.requests!.length,calls);assert.equal(result.status,'error');assert.ok(result.findings.length>0);
  assert.equal(JSON.stringify(result).includes('untrusted provider'),false);EngineResultSchema.parse(result);
}));
test('supported source text extensions are read without XML parsing or executing source',()=>fixture(async root=>{
  await fs.writeFile(path.join(root,'schema.xsd'),'<!DOCTYPE x [<!ENTITY remote SYSTEM "https://example.invalid/never">]><schema>&remote;</schema>');
  await fs.writeFile(path.join(root,'image.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><script>throw new Error()</script></svg>');
  await fs.writeFile(path.join(root,'binary.xsd'),Buffer.from([0,255,1]));
  const input=await inventory(root),before=input.fingerprint;await includeSecurityText(root,input);
  assert.equal(input.fingerprint,before);assert.ok(input.texts.has('schema.xsd'));assert.ok(input.texts.has('image.svg'));assert.ok(!input.texts.has('binary.xsd'));
  assert.deepEqual(input.coverage.ignored.map(x=>x.file),['binary.xsd']);
}));
test('extra text reader rejects changed snapshot bytes',()=>fixture(async root=>{
  await fs.writeFile(path.join(root,'schema.xsd'),'original');const input=await inventory(root);
  await fs.writeFile(path.join(root,'schema.xsd'),'tampered');await assert.rejects(includeSecurityText(root,input));
}));
test('source credential redaction preserves line numbers and executable context',()=>{
  const text='password = "synthetic-short-password"; do_work()\nAuthorization: Bearer synthetic-token-value\nclient_secret="synthetic-client-secret"\n';
  const redacted=redactSecurityText(text);
  assert.equal(redacted.split('\n').length,text.split('\n').length);assert.ok(redacted.includes('; do_work()'));
  for(const value of ['synthetic-short-password','synthetic-token-value','synthetic-client-secret'])assert.ok(!redacted.includes(value));
});
function response(findings:unknown,overrides:Record<string,unknown>={}) {
  return new Response(JSON.stringify({id:metadata.responseId,model:metadata.model,status:'completed',usage:{input_tokens:10,output_tokens:3,total_tokens:13},
    output:[{type:'message',status:'completed',content:[{type:'output_text',text:JSON.stringify({findings})}]}],...overrides}),{status:200});
}
test('API request is strict, fixed-model, no-store, source-only and injected transport is marked mocked',()=>fixture(async root=>{
  const input=await inventory(root);let seen=false;
  const provider=new OpenAISecurityProvider('synthetic-test-key',async(url,options)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options!.body as string);
    assert.equal(body.model,'gpt-6-luna');assert.equal(body.reasoning.effort,'none');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    const data=JSON.parse(body.input[1].content);assert.ok(data.fragments[0].id);assert.equal(data.groundTruth,undefined);seen=true;
    return response([finding(data.fragments[0].id)]);
  });
  const result=await reviewSecuritySemantic(input,provider);assert.ok(seen);assert.equal(result.status,'complete');assert.equal(result.transport,'test-double');
  assert.deepEqual(result.usage,metadata.usage);assert.equal(result.requests![0]!.responseId,metadata.responseId);EngineResultSchema.parse(result);
}));
test('incomplete API response retains identity and usage, with no retries',()=>fixture(async root=>{
  let calls=0;const provider=new OpenAISecurityProvider('synthetic-test-key',async()=>{calls++;return response([],{status:'incomplete'});});
  const result=await reviewSecuritySemantic(await inventory(root),provider);
  assert.equal(calls,1);assert.equal(result.status,'error');assert.equal(result.requests![0]!.responseId,metadata.responseId);assert.deepEqual(result.usage,metadata.usage);
}));
test('HTTP errors and oversized provider responses are bounded and raw bodies suppressed',()=>fixture(async root=>{
  for(const mode of ['http','size']){
    let calls=0;const provider=new OpenAISecurityProvider('synthetic-test-key',async()=>{calls++;return mode==='http'?new Response('private upstream error',{status:401}):new Response('x'.repeat(131073));});
    const result=await reviewSecuritySemantic(await inventory(root),provider);assert.equal(calls,1);assert.equal(result.status,'error');assert.ok(!JSON.stringify(result).includes('private upstream error'));
  }
}));
test('integration with batched semantic preserves original snapshot identity and validates request ledger',()=>fixture(async root=>{
  await fs.writeFile(path.join(root,'schema.xsd'),'<schema>ordinary text</schema>');
  const before=await inventory(root);
  const result=await reviewSecurity(root,{semantic:true,ciscoProvider:async()=>({status:'complete',findings:[],errors:[],version:'2.2.2',durationMs:1,analyzersUsed:[]}),semanticProvider:{name:'mock',async analyze(){return {findings:[]};}}});
  assert.equal(result.fingerprint,before.fingerprint);assert.equal(result.inspectionComplete,true);SecurityReviewSchema.parse(result);
  const bad=structuredClone(result);bad.engines[2]!.batching!.planned++;assert.throws(()=>SecurityReviewSchema.parse(bad));
}));
