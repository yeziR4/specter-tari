import test from 'node:test';import assert from 'node:assert/strict';
import {referencePolicy,controlledComparison} from '../src/reference-policy.mjs';
const account='component_'+'a'.repeat(64),other='component_'+'b'.repeat(64);
const envelope=(inputs=[],fee=[],main=[])=>({V1:{body:{transaction:{network:38,inputs,fee_instructions:fee,instructions:main}}}});
const call=a=>({CallMethod:{call:{Address:a},method:'pay_fee',args:[]}});
test('catches regression in fee targets AND declared inputs',()=>{
  const r=referencePolicy(envelope([{substate_id:account}],[call(account)]),account);assert.equal(r.status,'violated');assert.equal(r.matches.length,2);
});
test('absence only passes the stated explicit-reference scope',()=>{const r=referencePolicy(envelope([{substate_id:other}],[],[{PayFeeFromBucket:{bucket:{id:0,offset:null}}}]),account);assert.equal(r.status,'satisfied-in-scope');assert.match(r.limitation,/Not a claim of anonymity/);});
test('missing input array, unknown instruction and workspace reference are inconclusive',()=>{
  const d=envelope();delete d.V1.body.transaction.inputs;assert.equal(referencePolicy(d,account).status,'inconclusive');
  for(const ins of [{Future:{}},{CallMethod:{call:{Workspace:0},method:'x',args:[]}}])assert.equal(referencePolicy(envelope([],[],[ins]),account).status,'inconclusive');
});
test('false identity matches in arbitrary text do not satisfy the rule',()=>{
  const r=referencePolicy(envelope([],[],[{CallFunction:{address:'a'.repeat(64),function:'x',args:[account]}}]),account);assert.equal(r.status,'satisfied-in-scope');assert.match(r.scope,/direct/);assert.match(r.limitation,/encoded arguments/);
});
test('same ID, mismatched result ID and non-Commit cannot demonstrate comparison',()=>{
  const wrap=(id,tx,decision='Commit',resultId=id)=>({envelope:{transaction:{transaction_id:id,transaction:tx}},result:{result:{Finalized:{final_decision:decision,execution_result:{finalize:{transaction_hash:resultId}}}}}});
  const a=wrap('1'.repeat(64),envelope([],[call(account)])),b=wrap('2'.repeat(64),envelope());
  assert.equal(controlledComparison(a,b,account).status,'reference-reduced-in-scope');
  for(const x of [wrap('1'.repeat(64),envelope()),wrap('2'.repeat(64),envelope(),'Abort'),wrap('2'.repeat(64),envelope(),'Commit','3'.repeat(64))])assert.equal(controlledComparison(a,x,account).status,'inconclusive');
});
