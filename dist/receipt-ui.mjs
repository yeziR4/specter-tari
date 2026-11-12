import {receiptClient,receiptManifest,RECEIPT_DEPLOYMENT} from './lib/receipt.mjs?v=3';
const $=id=>document.getElementById(id),client=receiptClient(),storageKey='specter-mainnet-receipt-v1';
let bundle=null,record=null,busy=false;
try{record=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
const persist=()=>{if(record)localStorage.setItem(storageKey,JSON.stringify(record));};
function render(){
 $('receipt-request').disabled=busy||!bundle||!$('receipt-consent').checked||!!record;
 $('receipt-manifest').disabled=busy||!bundle;
 $('receipt-check').disabled=busy||!record;
 $('receipt-submit').disabled=busy||record?.walletStatus!=='approved'||!!record?.submissionAttempted;
 $('receipt-recovery').textContent=record?'Saved request '+record.requestId+' · report '+record.reportSha256+' · '+(record.walletStatus||'approval not checked'):'';
 $('receipt-reset').disabled=busy||!record||!['submitted','rejected','failed','expired','cancelled'].includes(record?.walletStatus);
}
async function action(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){$('receipt-status').textContent=e.message;}finally{busy=false;render();}}
function showResult(value){
 const tx=value?.transactionId||value?.transaction_id||value?.result?.transaction_id;
 $('receipt-status').textContent=tx?'Wallet returned transaction '+tx+'. Check the network outcome below. This is not yet a verified receipt.':'Wallet response saved. Use Check approval / recover result to recover its transaction ID.';
 if(/^[a-f0-9]{64}$/.test(tx||'')){const a=$('receipt-result');a.href='https://explorer.tari.mw/tx/'+tx;a.textContent='View receipt transaction ↗';a.hidden=false;record.submittedTransaction=tx;persist();}
}
document.addEventListener('specter:inspection-changed',()=>{bundle=null;$('receipt-consent').checked=false;render();});
document.addEventListener('specter:commitment',e=>{bundle=e.detail;$('receipt-status').textContent='Report exported. Transaction: '+bundle.transactionId+' · SHA-256: '+bundle.reportSha256+'. Review the public commitment details and fee cap before requesting approval.';render();});
$('receipt-consent').onchange=render;
$('receipt-manifest').onclick=()=>{
 try{
  const text=JSON.stringify(receiptManifest(bundle),null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='specter-wallet-manifest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('receipt-status').textContent='Manifest exported. Load it in your mainnet developer wallet’s Manifest page, estimate the fee, review the public signer link, and submit yourself. The wallet uses your default account for public fees. No transaction was submitted by this export.';
 }catch(e){$('receipt-status').textContent=e.message;}
};
$('receipt-request').onclick=()=>action(async()=>{
 record=await client.create(bundle);persist();$('receipt-status').textContent='Request saved. Review it in Sapient, then check approval here. It has not been submitted by Specter.';
});
$('receipt-check').onclick=()=>action(async()=>{
 const value=await client.check(record);record.walletStatus=value.status;record.lastResponse=value;persist();
 $('receipt-status').textContent='Wallet request: '+value.status+'.';if(value.status==='submitted')showResult(value.result);
});
$('receipt-submit').onclick=()=>action(async()=>{
 const checked=await client.check(record);if(checked.status!=='approved')throw Error('Request is '+checked.status+'. Check approval again.');
 const toSubmit={...record};record.submissionAttempted=true;persist();
 const result=await client.submit(toSubmit);record.walletStatus='submitted';record.lastResponse=result;persist();showResult(result);
});
$('receipt-reset').onclick=()=>{if(!['submitted','rejected','failed','expired','cancelled'].includes(record?.walletStatus))return;record=null;localStorage.removeItem(storageKey);$('receipt-result').hidden=true;render();};
$('receipt-publication').href='https://explorer.tari.mw/tx/'+RECEIPT_DEPLOYMENT.publicationTransaction;
render();
