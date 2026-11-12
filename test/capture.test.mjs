import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyCapture} from '../src/verify-capture.mjs';
import {analyze} from '../src/analyze.mjs';
import {compareReports} from '../src/compare.mjs';
import {walletReader} from '../src/wallet.mjs';
const fee=new URL('../evidence/capture-fee/',import.meta.url);
test('both real raw archives match hashes and result IDs',async()=>{
  for(const dir of [fee,new URL('../evidence/capture-stealth/',import.meta.url)]) {
    const {fileURLToPath}=await import('node:url');
    const r=await verifyCapture(fileURLToPath(dir));
    assert.equal(r.integrity,'matches-manifest');assert.equal(r.reportedDecision,'Commit');
  }
});
test('tampered archive rejected',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'specter-test-'));
  try {
    await cp(fee,dir,{recursive:true});
    const f=join(dir,'envelope.raw.json');await writeFile(f,(await readFile(f,'utf8'))+' ');
    await assert.rejects(verifyCapture(dir),/Integrity mismatch/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('comparisons never imply rank or controlled equivalence by default',()=>{
  const r=compareReports(analyze({}),analyze({}));assert.equal(r.controlled,false);assert.match(r.conclusion,/No privacy ranking/);
});
test('wallet lookup uses read-only surface and distinguishes result from envelope',async()=>{
  const calls=[];const reader=walletReader(()=>({request:async x=>{
    calls.push(x);return x.method==='tari_requestAccounts'?['component_example']:x.method==='tari_getCapabilities'?{transactionResultLookup:true}:{result:'Pending'};
  }}));
  await reader.connect();const r=await reader.lookup('a'.repeat(64));
  assert.equal(r.kind,'execution-result-only');
  assert(calls.every(x=>['tari_requestAccounts','tari_getCapabilities','tari_getNetwork','tari_getTransactionResult'].includes(x.method)));
  reader.invalidate();await assert.rejects(reader.lookup('a'.repeat(64)),/Connect/);
});
test('unsupported wallet capability never triggers lookup',async()=>{
  const reader=walletReader(()=>({request:async x=>x.method==='tari_requestAccounts'?['component_example']:{} }));
  await reader.connect();await assert.rejects(reader.lookup('a'.repeat(64)),/does not support/);
});
