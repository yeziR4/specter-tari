import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {literalHash,receiptOperation,reportCommitment,receiptClient,receiptManifest,RECEIPT_DEPLOYMENT} from '../src/receipt.mjs';
test('commitment matches exact UTF-8 export bytes and changes with evidence',async()=>{
 const report={network:'mainnet',findings:['Unicode evidence →']},id='ab'.repeat(32);
 const a=await reportCommitment(report,id,webcrypto);
 assert.equal(a.reportSha256,createHash('sha256').update(a.reportText).digest('hex'));
 assert.equal(a.reportBytes,Buffer.byteLength(a.reportText));
 const b=await reportCommitment({...report,findings:[]},id,webcrypto);
 assert.notEqual(a.reportSha256,b.reportSha256);
 await assert.rejects(reportCommitment({...report,network:'esmeralda'},id,webcrypto));
 await assert.rejects(reportCommitment(report,'bad',webcrypto));
});
test('receipt arguments encode CBOR text, with capped enforced private fee',()=>{
 const hash='ab'.repeat(32),id='cd'.repeat(32),template='12'.repeat(32);
 const arg=literalHash(hash).Literal;
 assert.equal(arg.slice(0,4),'7840');assert.equal(Buffer.from(arg.slice(4),'hex').toString(),hash);
 const op=receiptOperation('template_'+template,hash,id);
 assert.equal(op.instructions[0].CallFunction.address,template);
 assert.equal(op.instructions[0].CallFunction.function,'commit');
 assert.equal(op.maxFee,'100000');assert.equal(op.enforceFeeType,true);
 assert.equal(op.feeType,'private');
 for(const invalid of ['A'.repeat(64),'aa','g'.repeat(64)])assert.throws(()=>literalHash(invalid));
 assert.throws(()=>receiptOperation('',hash,id));
});
test('receipt requests refuse testnet, changed accounts and tampered operations',async()=>{
 let network='esmeralda',account='component_'+'12'.repeat(32),status='pending',submitted=0;
 const p={request:async({method})=>{
  if(method==='tari_getNetwork')return network;
  if(method==='tari_getAccounts')return [account];
  if(method==='tari_getCapabilities')return {transactionRequests:true,supportsPrivateFees:true};
  if(method==='tari_createTransactionRequest')return {requestId:'receipt-1'};
  if(method==='tari_getTransactionRequest')return {status};
  if(method==='tari_submitTransactionRequest'){submitted++;return {transaction_id:'ef'.repeat(32)};}
  throw Error(method);
 }};
 const client=receiptClient(()=>p),bundle={network:'mainnet',reportSha256:'ab'.repeat(32),transactionId:'cd'.repeat(32)};
 await assert.rejects(client.create(bundle),/Switch Sapient/);
 network='mainnet';const record=await client.create(bundle);
 await assert.rejects(client.submit(record),/Approve/);assert.equal(submitted,0);
 status='approved';account='component_'+'34'.repeat(32);await assert.rejects(client.submit(record),/account changed/);
 account=record.account;const bad=structuredClone(record);bad.operation.maxFee='999999';await assert.rejects(client.submit(bad),/changed/);
 await client.submit(record);assert.equal(submitted,1);
 await assert.rejects(client.submit({...record,submissionAttempted:true}),/already attempted/);
});
test('developer-wallet manifest binds the same report and only invokes receipt methods',()=>{
 const bundle={network:'mainnet',reportSha256:'ab'.repeat(32),transactionId:'cd'.repeat(32)};
 const [tab]=receiptManifest(bundle);
 assert.ok(tab.code.includes('template_'+RECEIPT_DEPLOYMENT.templateAddress));
 assert.ok(tab.code.includes(`commit("${bundle.reportSha256}", "${bundle.transactionId}")`));
 assert.ok(tab.code.includes('receipt.report_hash();'));
 assert.ok(tab.code.includes('receipt.schema_version();'));
 assert.deepEqual(tab.variables,{});assert.deepEqual(tab.signingKeys,[]);
 assert.throws(()=>receiptManifest({...bundle,reportSha256:'invalid'}));
 assert.throws(()=>receiptManifest({...bundle,network:'esmeralda'}));
});
