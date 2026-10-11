import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHoneySkillScenario, isHoneySkillAuthorizedPayment, runHoneySkillDemo } from '../packages/security-lab/src/honeyskill-demo.js';
import { assessAction, compilePolicy, createEmptyState, POLICY_VERSION, UINT256_MAX, type ProposedAction } from '../packages/security-policy/src/index.js';
const fees={gasLimit:'21000',maxFeePerGasWei:'2000000000',maxPriorityFeePerGasWei:'1000000000'};
const template:ProposedAction={id:'invoice-payment',capabilityId:'invoice-payment',type:'send',chainId:43113,sender:'0x1111111111111111111111111111111111111111',asset:'native',recipient:'0x2222222222222222222222222222222222222222',amountUnits:'1000000000000000',fees};
const policy=compilePolicy({version:POLICY_VERSION,id:'test-invoice',chainId:43113,wallet:template.sender,expiresAtSeconds:1000,maxCalls:1,maxAttempts:8,feeLimits:fees,maxTotalGasCostWei:'42000000000000',maxNativeCostWei:'1042000000000000',assetBudgets:[{asset:'native',maxUnits:template.amountUnits}],capabilities:[{id:'invoice-payment',type:'send',maxUses:1,asset:'native',recipient:template.recipient,amountUnits:template.amountUnits}]});

test('controlled scenarios express three distinct unauthorized mechanisms without redefining user authorization',()=>{
  const good=createHoneySkillScenario('checkout-helper',template),redirect=createHoneySkillScenario('settlement-router',template),extra=createHoneySkillScenario('invoice-assistant',template),approval=createHoneySkillScenario('settlement-connect',template);
  assert.equal(good.length,1);assert.equal(redirect.length,1);assert.equal(extra.length,2);assert.equal(approval.length,2);
  assert.equal(approval[0]!.type,'approve');assert.equal('amountUnits'in approval[0]!&&approval[0].amountUnits,UINT256_MAX);
  const actions=[...good,...redirect,...extra,...approval];
  assert.equal(actions.filter(a=>isHoneySkillAuthorizedPayment(a,template)).length,3);
  for(const action of actions)assert.equal(assessAction(policy,action,createEmptyState(),100).allowed,isHoneySkillAuthorizedPayment(action,template));
  assert.equal(isHoneySkillAuthorizedPayment({...template,fees:{...fees,maxFeePerGasWei:'9000000000'}},template),false);
  assert.equal(isHoneySkillAuthorizedPayment({...template,chainId:1},template),false);
});

test('actual controlled local replay proves payment deltas, denied effects and counterfactual isolation',{
  skip:process.env.HONEYSKILL_LIVE_DEMO!=='1',timeout:60000,
},async()=>{
  const report=await runHoneySkillDemo({network:'local'});
  assert.equal(report.passed,true);assert.equal(report.modelCalls,0);assert.equal(report.network.kind,'owned-local-evm-genesis');assert.equal(report.network.chainId,31337);
  assert.deepEqual([report.metrics.actionPolicy.tp,report.metrics.actionPolicy.fp,report.metrics.actionPolicy.tn,report.metrics.actionPolicy.fn],[3,0,3,0]);
  assert.equal(report.metrics.scenarioEffects.unguardedUnauthorized,3);assert.equal(report.metrics.scenarioEffects.guardedUnauthorized,0);
  assert.equal(report.metrics.scenarioEffects.guardedExactPayments,3);assert.equal(report.metrics.modelComparison.status,'not_run');
  assert(report.scenarios.every(x=>Object.values(x.assertions).every(Boolean)));
  assert.equal(report.scenarios.find(x=>x.id==='settlement-connect')!.unguarded.after.labAllowanceUnits,UINT256_MAX);
  assert(!JSON.stringify(report).includes('/Users/')&&!JSON.stringify(report).includes('127.0.0.1'));
});
