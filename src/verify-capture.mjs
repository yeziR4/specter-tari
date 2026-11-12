import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {parseLossless} from './json.mjs';
export async function verifyCapture(directory) {
  const dir=resolve(directory);
  const manifest=parseLossless(await readFile(resolve(dir,'manifest.json'),'utf8'));
  if(manifest.format!=='specter-capture-v1'||!Array.isArray(manifest.files)||manifest.files.length!==2||!/^([a-f0-9]{64})$/.test(manifest.transactionId)) throw Error('Invalid capture manifest.');
  const expected=['envelope.raw.json','result.raw.json'];
  const data={};
  for(const file of expected) {
    const entries=manifest.files.filter(f=>f.file===file);
    if(entries.length!==1)throw Error('Missing or duplicate capture file.');
    const entry=entries[0];
    const bytes=await readFile(resolve(dir,file));
    if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256) throw Error(`Integrity mismatch: ${file}`);
    data[file]=parseLossless(bytes.toString('utf8'));
  }
  const envelope=data[expected[0]],result=data[expected[1]];
  const envelopeId=envelope?.transaction?.transaction_id;
  const final=result?.result?.Finalized;
  const resultId=final?.execution_result?.finalize?.transaction_hash;
  if(envelopeId!==manifest.transactionId||resultId!==manifest.transactionId) throw Error('Transaction/result ID mismatch.');
  return {manifest,envelope,result,integrity:'matches-manifest',reportedDecision:final.final_decision,
    verification:'Local archive integrity and response ID agreement only; indexer honesty, signatures and consensus proofs not verified.'};
}
