import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseLossless} from './json.mjs';
const [id, destination] = process.argv.slice(2);
if (!/^[a-f0-9]{64}$/.test(id ?? '') || !destination) throw Error('Usage: node src/capture.mjs <transaction-id> <new-archive-directory>');
const base='https://ootle-indexer-a.tari.com';
const files=[];
const dir=resolve(destination);
await mkdir(dir); // Refuse overwrite; archived bytes and manifests stay paired.
for(const [name,suffix] of [['envelope',''],['result','/result']]) {
  const url=`${base}/transactions/${id}${suffix}`;
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok) throw Error(`${url}: HTTP ${response.status}; incomplete archive must not be used as a complete pair.`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>5_000_000) throw Error('Response exceeds 5 MB.');
  const parsed=parseLossless(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const observedId=name==='envelope'?parsed?.transaction?.transaction_id:parsed?.result?.Finalized?.execution_result?.finalize?.transaction_hash;
  if(observedId!==id) throw Error(`${name}: transaction ID unavailable or mismatched; no complete manifest written.`);
  const file=`${name}.raw.json`;
  await writeFile(resolve(dir,file),bytes,{flag:'wx'});
  files.push({file,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),capturedAt:new Date().toISOString(),httpStatus:response.status});
}
const manifest={format:'specter-capture-v1',network:'esmeralda',transactionId:id,files,verification:'Downloaded over HTTPS from one public indexer; signatures and consensus proofs not verified.'};
await writeFile(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(manifest,null,2));
