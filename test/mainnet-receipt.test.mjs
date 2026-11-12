import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseLossless} from '../src/json.mjs';
import {RECEIPT_DEPLOYMENT} from '../src/receipt.mjs';
test('recorded mainnet receipt commits the exported report and executes all getters',async()=>{
 const base=new URL('../evidence/mainnet-receipt/',import.meta.url);
 const v=JSON.parse(await readFile(new URL('verification.json',base),'utf8'));
 for(const [name,hash]of Object.entries(v.filesSha256))assert.equal(createHash('sha256').update(await readFile(new URL(name,base))).digest('hex'),hash);
 const e=parseLossless(await readFile(new URL('envelope.raw.json',base),'utf8')).transaction;
 assert.equal(e.transaction_id,v.receiptTransaction);assert.equal(e.summary.outcome,'Commit');
 assert.equal(v.templateAddress,RECEIPT_DEPLOYMENT.templateAddress);
 const instructions=e.transaction.V1.body.transaction.instructions;
 assert.equal(instructions[0].CallFunction.address,RECEIPT_DEPLOYMENT.templateAddress);
 assert.deepEqual(instructions.filter(i=>i.CallMethod).map(i=>i.CallMethod.method),v.getterCallsCommitted);
 assert.equal(v.reportSha256,v.filesSha256['report.json']);
});
