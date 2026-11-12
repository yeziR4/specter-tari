import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseLossless} from '../src/json.mjs';
import {analyze} from '../src/analyze.mjs';
test('captured mainnet publication preserves exact integers and exposes fee reference with explicit unsupported publish scope',()=>{
 const bytes=readFileSync(new URL('../evidence/mainnet-publish/envelope.raw.json',import.meta.url));
 const manifest=JSON.parse(readFileSync(new URL('../evidence/mainnet-publish/manifest.json',import.meta.url)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 const doc=parseLossless(bytes.toString());
 assert.equal(doc.transaction.transaction.V1.body.transaction.network,0);
 assert.equal(String(doc.transaction.transaction.V1.body.transaction.nonce),'7885595782782887214');
 const report=analyze(doc);
 assert.equal(report.scope,'v1-instruction-fields');
 assert.ok(report.findings.some(f=>f.rule==='PUBLIC_FEE_COMPONENT'));
 assert.ok(report.unknowns.some(f=>f.includes('PublishTemplate')));
});
