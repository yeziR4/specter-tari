import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLossless} from '../src/json.mjs';
import {analyze} from '../src/analyze.mjs';
import {readFile} from 'node:fs/promises';
test('live nonce preserved exactly from original bytes',async()=>{
  const text=await readFile(new URL('../evidence/live-envelope.raw.json',import.meta.url),'utf8');
  const doc=parseLossless(text);
  assert.equal(doc.transaction.transaction.V1.body.transaction.nonce,'7303555905965440489');
  const r=analyze(doc);
  assert.equal(r.scope,'v1-instruction-fields');
  assert(r.findings.some(x=>x.rule==='PUBLIC_FEE_COMPONENT'));
});
test('quoted numbers and escaped strings untouched',()=>{
  assert.deepEqual(parseLossless('{"n":"9007199254740993","x":"\\\"9007199254740994","s":42}'),{n:'9007199254740993',x:'"9007199254740994',s:42});
});
test('invalid JSON is rejected, never repaired',()=>{
  for(const s of ['{"x":01}','{"x":9007199254740993x}','{"x":NaN}','{"x":"\\q"}']) assert.throws(()=>parseLossless(s));
});
test('matching result does not masquerade as envelope',async()=>{
  const text=await readFile(new URL('../evidence/live-result.raw.json',import.meta.url),'utf8');
  assert.equal(analyze(parseLossless(text)).scope,'unsupported');
});
