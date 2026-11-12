import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyze, evaluatePolicy} from '../src/analyze.mjs';
const a = 'component_' + 'a'.repeat(64);
const wrap = (fee=[], main=[]) => ({V1:{body:{transaction:{fee_instructions:fee,instructions:main}}}});
const call = target => ({CallMethod:{call:{Address:target},method:'pay_fee',args:[]}});
const transfer = (value='0', revealed=null, floor='0') => ({StealthTransfer:{statement:{inputs_statement:{revealed_amount:value},outputs_statement:{revealed_output:revealed,outputs:[{output:{minimum_value_promise:floor}}]}}}});
test('real observation detects fee target but preserves missing main stage as unknown', async()=>{
  const d=JSON.parse(await readFile(new URL('../fixtures/live-fee-observation.json',import.meta.url)));
  const r=analyze(d);
  assert.equal(r.scope,'partial-observation');
  assert(r.findings.some(f=>f.rule==='PUBLIC_FEE_COMPONENT' && f.path==='$.observed.fee_instructions[0].CallMethod.call.Address'));
  assert(r.unknowns.some(s=>s.includes('instructions: missing')));
});
test('same finding in fee and main stages, fee rule only applies to fee stage',()=>{
  const r=analyze(wrap([call(a)],[call(a)]),{knownAccounts:[a]});
  assert.equal(r.findings.filter(f=>f.rule==='KNOWN_ACCOUNT_REFERENCE').length,2);
  assert.equal(r.findings.filter(f=>f.rule==='PUBLIC_FEE_COMPONENT').length,1);
});
test('arbitrary components are not labelled known accounts',()=>assert(!analyze(wrap([call(a)])).findings.some(f=>f.rule==='KNOWN_ACCOUNT_REFERENCE')));
test('nested text cannot impersonate a real component reference',()=>{
  const r=analyze(wrap([{CallFunction:{args:[a],function:'pay_fee'}}]),{knownAccounts:[a]});
  assert.equal(r.findings.length,0);
});
test('revealed amount larger than safe integer remains exact',()=>{
  const r=analyze(wrap([], [transfer('90071992547409931234')]));
  assert.equal(r.findings.find(f=>f.rule==='REVEALED_INPUT_AMOUNT').value,'90071992547409931234');
});
test('unsafe numeric amount never accepted',()=>{
  const r=analyze(wrap([], [transfer(9007199254740992)]));
  assert(r.unknowns.some(x=>x.includes('Unsafe')));
  assert(!r.findings.some(f=>f.rule==='REVEALED_INPUT_AMOUNT'));
});
test('negative and out of range amounts are unknown',()=>{
  for(const n of ['-1',(1n<<128n).toString()]) assert(analyze(wrap([], [transfer(n)])).unknowns.some(x=>x.includes('revealed_amount')));
});
test('null revealed output differs from missing field',()=>{
  const t=transfer();delete t.StealthTransfer.statement.outputs_statement.revealed_output;
  assert(analyze(wrap([], [t])).unknowns.some(x=>x.endsWith('revealed_output: missing')));
  assert(!analyze(wrap([], [transfer()])).unknowns.some(x=>x.endsWith('revealed_output: missing')));
});
test('positive public floor is output-specific',()=>assert(analyze(wrap([], [transfer('0',null,'100')])).findings.some(f=>f.rule==='PUBLIC_VALUE_FLOOR'&&f.value==='100')));
test('malformed and future versions cannot pass policy',()=>{
  for(const d of [{},{V2:{}},null,{V1:{body:{transaction:{}}}}]) assert.equal(evaluatePolicy(analyze(d)).status,'unknown');
});
test('redacted known account remains inconclusive, not privacy passing',()=>{
  const r=analyze(wrap([call('component_'+'b'.repeat(64))]),{knownAccounts:[a]});
  assert.equal(evaluatePolicy(r,{forbid:['KNOWN_ACCOUNT_REFERENCE']}).status,'unknown');
});
test('known account regression fails policy',()=>{
  assert.equal(evaluatePolicy(analyze(wrap([call(a)]),{knownAccounts:[a]}),{forbid:['KNOWN_ACCOUNT_REFERENCE']}).status,'violated');
});
