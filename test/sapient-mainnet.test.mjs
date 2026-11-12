import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseLossless} from '../src/json.mjs';
import {literalHash,RECEIPT_DEPLOYMENT} from '../src/receipt.mjs';
test('live Sapient receipt committed the exact exported report to the pinned template',async()=>{
 const base=new URL('../evidence/sapient-mainnet-receipt/',import.meta.url);
 const v=JSON.parse(await readFile(new URL('verification.json',base),'utf8'));
 for(const [name,hash]of Object.entries(v.filesSha256))assert.equal(createHash('sha256').update(await readFile(new URL(name,base))).digest('hex'),hash);
 const e=parseLossless(await readFile(new URL('envelope.raw.json',base),'utf8')).transaction;
 assert.equal(e.transaction_id,v.transactionId);assert.equal(e.summary.outcome,'Commit');
 const call=e.transaction.V1.body.transaction.instructions[0].CallFunction;
 assert.equal(call.address,RECEIPT_DEPLOYMENT.templateAddress);assert.equal(call.function,'commit');
 assert.deepEqual(call.args,[literalHash(v.reportSha256),literalHash(v.inspectedTransaction)]);
 assert.equal(v.reportSha256,v.filesSha256['report.json']);
 assert.equal(String(e.summary.total_fees_paid),'100000');
});
