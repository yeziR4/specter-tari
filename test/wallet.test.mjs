import test from 'node:test';
import assert from 'node:assert/strict';
import {walletReader} from '../src/wallet.mjs';
const account='component_'+'a'.repeat(64);
const fake=overrides=>({request:async({method})=>{
  if(Object.hasOwn(overrides,method))return typeof overrides[method]==='function'?overrides[method]():overrides[method];
  return {tari_getAccounts:[account],tari_requestAccounts:[account],tari_getCapabilities:{transactionResultLookup:true},tari_getNetwork:'esmeralda',tari_disconnect:null}[method];
}});
test('restore detects approved account without prompting',async()=>{
  const p=fake({tari_requestAccounts:()=>{throw Error('must not prompt');}});const r=await walletReader(()=>p).restore();assert.equal(r.accounts[0],account);assert.equal(r.network,'esmeralda');
});
test('missing extension restore returns null',async()=>assert.equal(await walletReader(()=>null).restore(),null));
test('declined account request is not reported connected',async()=>{
  const r=walletReader(()=>fake({tari_requestAccounts:()=>{throw Object.assign(Error('Declined'),{code:4001});}}));
  await assert.rejects(r.connect(),e=>e.code===4001);await assert.rejects(r.lookup('a'.repeat(64)),/Connect/);
});
test('capability failure preserves successful account connection with limited state',async()=>{
  const r=await walletReader(()=>fake({tari_getCapabilities:()=>{throw Error('unavailable');}})).connect();assert.equal(r.accounts[0],account);assert.equal(r.limited,true);
});
test('invalidation prevents late account approval restoring stale connection',async()=>{
  let approve;const r=walletReader(()=>fake({tari_requestAccounts:()=>new Promise(resolve=>approve=resolve)}));const pending=r.connect();r.invalidate();approve([account]);await assert.rejects(pending,/changed/);
});
test('wallet that never replies times out with a recovery instruction',async()=>{
  const r=walletReader(()=>fake({tari_requestAccounts:()=>new Promise(()=>{})}),{timeoutMs:10});await assert.rejects(r.connect(),/Open the Sapient extension/);
});
test('disconnect invalidates reader and revokes site permission',async()=>{
  let disconnected=false;const r=walletReader(()=>fake({tari_disconnect:()=>{disconnected=true;}}));await r.connect();await r.disconnect();assert(disconnected);await assert.rejects(r.lookup('a'.repeat(64)),/Connect/);
});
