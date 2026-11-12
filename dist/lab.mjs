import {experimentClient,LAB_CONFIG} from './lib/experiment.mjs?v=4';
import {controlledComparison,referencePolicy} from './lib/reference-policy.mjs?v=4';
import {parseLossless} from './lib/json.mjs?v=2';
const $=id=>document.getElementById(id),client=experimentClient();
const node=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
let ready=null,records={},captures={},busy=false,generation=0;
const key=account=>'specter-fee-test-v1:'+account;
function message(s){$('lab-status').textContent=s;}
function persist(){if(ready)localStorage.setItem(key(ready.account),JSON.stringify({format:'specter-lab-v1',account:ready.account,records}));}
function render(){
 $('lab-account').textContent=ready?ready.account:'Connect using the top-right wallet control, then check readiness.';
 $('lab-funding').textContent=ready?(ready.revealedEnough?'Public fee cap is covered. Private funds were not read; the wallet will check them before signing.':'Test funding is needed: the public-fee step requires 0.1 test TARI in revealed balance. Private balance was not requested.'):'Readiness has not been checked. No test transaction has been requested.';
 for(const mode of ['transparent','private']){
  const r=records[mode],prefix=mode==='transparent'?'public':'private';
  $(prefix+'-request').disabled=busy||!ready||!!r||(mode==='transparent'&&!ready.revealedEnough)||(mode==='private'&&!records.transparent?.transactionId);
  $(prefix+'-check').disabled=busy||!ready||!r;
  $(prefix+'-submit').disabled=busy||!ready||r?.walletStatus!=='approved'||!!r?.submissionAttempted;
  const msg=r?.transactionId?'Submitted: '+r.transactionId:r?'Wallet request saved Â· '+(r.walletStatus||'approval not yet checked'):'Not started';
  $(prefix+'-status').textContent=msg;
 }
 $('lab-capture').disabled=busy||!ready||!records.transparent?.transactionId||!records.private?.transactionId;
 $('lab-export').disabled=busy||!ready||!Object.keys(captures).length;
 $('lab-check').disabled=busy;
 const phase=!ready?0:!records.transparent?.transactionId?1:!records.private?.transactionId?2:3;
 $('wizard-step').textContent=(phase+1)+' / 4';
 $('wizard-title').textContent=['Prepare your test wallet','First payment · public fee','Second payment · private fee','Compare the evidence'][phase];
 $('wizard-fill').style.width=((phase+1)*25)+'%';
 document.querySelector('.lab-ack').hidden=phase!==1&&phase!==2;
 document.querySelector('.lab-steps').hidden=phase===0||phase===3;
 document.querySelectorAll('.lab-steps article').forEach((n,i)=>n.hidden=phase!==i+1);
 for(const mode of ['transparent','private']){
   const r=records[mode],prefix=mode==='transparent'?'public':'private';
   $(prefix+'-request').hidden=!!r;
   $(prefix+'-check').hidden=!r||r.walletStatus==='approved';
   $(prefix+'-submit').hidden=!r||r.walletStatus!=='approved'||!!r.submissionAttempted;
 }
 document.querySelector('.lab-finish').hidden=phase!==3;
 $('lab-check').hidden=!!ready&&ready.revealedEnough;
 $('lab-capture').hidden=!!captures.comparison;
 $('lab-export').hidden=!captures.comparison;
 $('lab-reset').hidden=!Object.keys(records).length;
 document.querySelector('.lab-limit').hidden=phase!==3;

}
async function action(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){message(e.code===4001?'You declined the wallet request. No new request will be submitted automatically.':/unavailable|no tari provider|not running inside/i.test(e.message)?'Open this site in Chrome where Sapient is installed, unlock it, and connect using the top-right wallet control. The built-in chat browser cannot use your Chrome extension.':e.message);}finally{busy=false;render();}}
$('lab-check').onclick=()=>action(async()=>{
 const attempt=++generation;const r=await client.readiness();if(attempt!==generation)throw Error('Account changed during readiness check. Try again.');ready=r;records={};captures={};
 const saved=localStorage.getItem(key(r.account));if(saved){const d=JSON.parse(saved);if(d.format==='specter-lab-v1'&&d.account===r.account&&d.records&&typeof d.records==='object')records=d.records;}
 localStorage.setItem(key(r.account),JSON.stringify({format:'specter-lab-v1',account:r.account,records}));
 message(r.revealedEnough?'Wallet ready for review. Confirm that this is a throwaway test account, then request the public-fee step.':'Wallet supports the test, but test funding is missing. No burn, shield or transfer has been started.');render();
});
function recordResult(mode,result){
 const id=result?.transactionId;if(!/^[a-f0-9]{64}$/.test(id||''))throw Error('The wallet did not return a transaction ID. Use Check approval to recover the original request; do not create another request.');
 records[mode].transactionId=id;records[mode].walletStatus='submitted';persist();
}
for(const mode of ['transparent','private']){
 const prefix=mode==='transparent'?'public':'private';
 $(prefix+'-request').onclick=()=>action(async()=>{
  if(!ready||records[mode])throw Error('Check readiness first. Existing requests must be recovered, not recreated.');
  if(!$('lab-consent').checked)throw Error('Read and confirm the test-only acknowledgement before creating a wallet request.');
  if(mode==='private'){
    const publicCapture=await fetchCapture(records.transparent.transactionId);
    const finalized=publicCapture.result?.result?.Finalized;
    if(finalized?.final_decision!=='Commit'||finalized?.execution_result?.finalize?.transaction_hash!==records.transparent.transactionId)throw Error('The public-fee transfer is not yet confirmed as Commit by the indexer. Wait and retry this step; no private-fee request was created.');
    captures.transparent=publicCapture;
  }
  const reviewedAccount=ready.account,attempt=generation;
  const record=await client.create(mode,ready);record.walletStatus='pending';
  if(attempt!==generation){
    const saved=JSON.parse(localStorage.getItem(key(reviewedAccount))||'{"format":"specter-lab-v1","records":{}}');saved.account=reviewedAccount;saved.records[mode]=record;localStorage.setItem(key(reviewedAccount),JSON.stringify(saved));
    throw Error('Account changed while creating the request. Its ID was saved for the original test account. Switch back and check readiness to recover it.');
  }
  records[mode]=record;persist();
  message('Request created. Review the self-payment and '+(mode==='transparent'?'public':'private')+' fee in Sapient. After approving, click Check approval. Nothing is submitted automatically.');
 });
 $(prefix+'-check').onclick=()=>action(async()=>{
  const r=records[mode];const status=await client.check(r);r.walletStatus=status.status;
  if(status.status==='submitted')recordResult(mode,status.result);else persist();
  message(status.status==='approved'?'Approval confirmed. Review the amount and fee cap here, then press Submit approved test transfer.':status.status==='submitted'?'Recovered the submitted transaction ID. No second transfer was submitted.':status.status==='rejected'||status.status==='failed'?'The request is '+status.status+'. '+(status.error||'Start a new test only after reviewing your wallet history.'):'Wallet status: '+status.status+'. Open Sapient to review the request.');
 });
 $(prefix+'-submit').onclick=()=>action(async()=>{
  const r=records[mode];r.submissionAttempted=true;persist();
  message('Submitting the already approved test transfer. If the response is lost, use Check approval to recover it.');
  const {result}=await client.submit(r);recordResult(mode,result);message('Wallet returned a transaction ID. This is not yet evidence of a committed transaction.');
 });
}
async function fetchCapture(id){
 const base='https://ootle-indexer-a.tari.com/transactions/'+id;const raw={};
 for(const [name,suffix]of[['envelope',''],['result','/result']]){
  const r=await fetch(base+suffix,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Indexer capture failed (HTTP '+r.status+'). Keep the request IDs and retry capture later.');
  raw[name]=await r.text();parseLossless(raw[name]);
 }
 return {envelope:parseLossless(raw.envelope),result:parseLossless(raw.result),raw,capturedAt:new Date().toISOString(),source:base};
}
$('lab-capture').onclick=()=>action(async()=>{
 message('Fetching both signed envelopes and execution resultsâ€¦');const attempt=generation;
 const [left,right]=await Promise.all([fetchCapture(records.transparent.transactionId),fetchCapture(records.private.transactionId)]);if(attempt!==generation)throw Error('Account changed during capture.');
 const result=controlledComparison(left,right,ready.account);captures={transparent:left,private:right};
 const panel=$('lab-results');panel.replaceChildren(node('h3',result.status==='reference-reduced-in-scope'?'The known reference was reduced in the inspected fields':'The expected difference is not established yet'));
 panel.append(node('p','Public fee: '+result.publicPolicy.status+' Â· Private fee: '+result.privatePolicy.status));
 result.publicPolicy.matches.forEach(x=>panel.append(node('code','Public reference: '+x.path)));
 panel.append(node('p',result.limitation));
 if(result.status==='reference-reduced-in-scope'){
  // Deliberately mutate an in-memory copy only. Never submit the regression to the network.
  const mutated=structuredClone(right.envelope);mutated.transaction.transaction.V1.body.transaction.inputs.push({substate_id:ready.account,version:null,is_write:false});
  const regression=referencePolicy(mutated,ready.account);
  panel.append(node('h3',regression.status==='violated'?'Regression caught: the reference returned':'Regression test did not behave as expected'),node('p','Synthetic local mutation only: the known account was reinserted as a declared input. This was not signed or sent to the network.'));
  captures.regression={kind:'synthetic-local-mutation',report:regression};
 }
 captures.comparison=result;message(result.status==='reference-reduced-in-scope'?'Comparison captured. Export the evidence before leaving this page.':'Captured responses, but the scoped result is inconclusive. Export them for investigation.');
});
$('lab-export').onclick=()=>{
 const bundle={format:'specter-lab-evidence-v1',network:'esmeralda',account:ready.account,requestedOperations:{transparent:records.transparent.operation,private:records.private.operation},transactionIds:{transparent:records.transparent.transactionId,private:records.private.transactionId},captures,notice:'Contains public test addresses and locally recorded requested payment terms. Export only from a throwaway test account. Raw endpoint response strings are included for integrity re-capture; no keys or view access.'};
 const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}));const a=node('a','');a.href=url;a.download='specter-controlled-test.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('lab-reset').onclick=()=>action(async()=>{
 if(!ready)throw Error('Check readiness for the original test account first.');
 for(const record of Object.values(records)){
   const s=await client.check(record);
   if(!['submitted','rejected','failed'].includes(s.status))throw Error('A wallet request is still '+s.status+'. Reject it in Sapient or recover its result before starting a new test.');
 }
 if(!confirm('Start a new test? Export existing evidence first. New transfers will require new wallet approvals and may spend test-token fees again.'))return;
 records={};captures={};persist();$('lab-results').replaceChildren();message('New test prepared. No transaction has been requested.');
});
function invalidate(){generation++;ready=null;records={};captures={};$('lab-results').replaceChildren();message('Wallet account changed. Check readiness again before continuing.');render();}
window.addEventListener('tari#accountsChanged',invalidate);window.addEventListener('specter:wallet-invalidated',invalidate);render();
