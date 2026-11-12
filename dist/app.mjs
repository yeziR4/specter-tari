import {analyze} from './lib/analyze.mjs?v=2';
import {parseLossless} from './lib/json.mjs?v=2';
import {compareReports} from './lib/compare.mjs?v=2';
import {walletReader} from './lib/wallet.mjs?v=2';
import {reportCommitment} from './lib/receipt.mjs?v=2';

const $=id=>document.getElementById(id);
const el=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;};
const short=s=>s.length>24?s.slice(0,14)+'…'+s.slice(-8):s;
const labels={
 PUBLIC_COMPONENT_CALL:['A public application call','The transaction names a component it calls. That reference is visible on the public ledger.'],
 PUBLIC_FEE_COMPONENT:['The fee payment names an account reference','The fee instruction calls pay_fee on this public component. Someone inspecting the transaction can see the reference.'],
 KNOWN_ACCOUNT_REFERENCE:['Your known account reference appears','This matches the address supplied for this check. It does not identify the person who owns it.'],
 REVEALED_INPUT_AMOUNT:['An input amount is visible','This value appears in plain text, in the resource’s raw units. It is not necessarily the payment amount.'],
 REVEALED_OUTPUT_AMOUNT:['An output amount is visible','This value is public, in raw resource units. In the fee stage, it can fund fees rather than disclose the private payment.'],
 STEALTH_OUTPUT_COUNT:['The number of private outputs is visible','Amounts can be hidden while the number of outputs remains public. Output count alone does not establish a connection.'],
 PUBLIC_VALUE_FLOOR:['A minimum value is public','This output publicly promises a minimum value. This is not a disclosure of the whole wallet balance.']
};
let current=null,report=null,loadGeneration=0,walletState=null,connecting=false,uiGeneration=0;
let currentNetwork="unverified";
let latestBundle=null;
const samples={}; const reader=walletReader(); const dialog=$('wallet-dialog');
function setStatus(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function clearReport(){report=null;$('download').disabled=true;$('findings').replaceChildren();$('unknowns').replaceChildren();$('finding-count').textContent='';$('unknown-count').textContent='';$('comparison').hidden=true;$('summary-title').textContent='No inspection available';$('summary-description').textContent='Choose a recorded example or try another transaction. No privacy conclusion has been made.';$('capture-name').textContent='No transaction selected';$('transaction-link').hidden=true;$('capture-source').textContent='Not inspected';}
function inspect(){
 try{
  document.dispatchEvent(new Event('specter:inspection-changed'));
  if(!current)throw Error('Choose an example, paste a transaction ID, or import JSON first.');
  const account=$('account').value.trim();report=analyze(current,{knownAccounts:account?[account]:[]});report.network=currentNetwork;
  $('findings').replaceChildren();$('unknowns').replaceChildren();$('comparison').hidden=true;
  // Do not repeat a generic component finding when the same field has a more specific fee finding.
  const feePaths=new Set(report.findings.filter(f=>f.rule==='PUBLIC_FEE_COMPONENT').map(f=>f.path));
  const visible=report.findings.filter(f=>f.rule!=='PUBLIC_COMPONENT_CALL'||!feePaths.has(f.path));
  $('finding-count').textContent=visible.length+' observed';
  for(const [i,f] of visible.entries()){
   const card=el('article','','finding'),top=el('div','','finding-top'),body=el('div','');
   const copy=labels[f.rule]||[f.rule,f.explanation];
   body.append(el('h3',copy[0]),el('p',copy[1]));top.append(el('span',String(i+1).padStart(2,'0'),'finding-number'),body);card.append(top);
   const details=el('details','');details.append(el('summary','Show the evidence'),el('code','Observed value: '+f.value),el('code','Source field: '+f.path),el('p',f.explanation));card.append(details);$('findings').append(card);
  }
  if(!visible.length)$('findings').append(el('p','No supported observations were found. This is not a passing privacy verdict.'));
  report.unknowns.forEach(u=>$('unknowns').append(el('li',u)));
  $('unknown-count').textContent=report.unknowns.length+' inspection limits';
  const hasFee=report.findings.some(f=>f.rule==='PUBLIC_FEE_COMPONENT'),hasKnown=report.findings.some(f=>f.rule==='KNOWN_ACCOUNT_REFERENCE');
  $('summary-title').textContent=hasKnown?'A known account reference is visible':hasFee?'The fee payment leaves a public reference':report.scope==='unsupported'?'This file cannot be inspected yet':'Private transfers can still leave public traces';
  $('summary-description').textContent=hasKnown?'The account address supplied for this check appears in a public component call. Open its evidence to see exactly where.':hasFee?'The fee-stage call exposes a component address. This does not establish a person’s identity or prove that the application intended to hide it.':report.scope==='unsupported'?'Import a signed V1 transaction envelope. A wallet execution result is a different document and does not contain the same instruction fields.':'Review the observed fields below. Hidden values and visible transaction structure can coexist; neither implies complete anonymity.';
  $('download').disabled=false;setStatus('Inspection complete · '+report.observedInstructionCount+' instructions reviewed · no wallet or funds used.');
  $('receipt-export').disabled=currentNetwork!=='mainnet'||!/^[a-f0-9]{64}$/.test(current?.transaction?.transaction_id||'');
 }catch(e){clearReport();setStatus(e.message,true);}
}
function provenance(doc,name,source){
 const id=doc?.transaction?.transaction_id;const a=$('transaction-link');
 const net=doc?.transaction?.transaction?.V1?.body?.transaction?.network;
 currentNetwork=net===0?'mainnet':source.includes('Archived')?'esmeralda':'unverified';
 $('capture-name').textContent=name;$('capture-source').textContent=source;
 if(/^[a-f0-9]{64}$/.test(id||'')){a.textContent=short(id);a.href=(source.includes('Archived')?'https://testnet-explorer.tari.mw':'https://explorer.tari.mw')+'/tx/'+id;a.hidden=false;$('wallet-txid').value=id;}
 else{a.hidden=true;a.removeAttribute('href');}
}
async function getSample(name){
 if(!samples[name]){const r=await fetch('evidence/'+name+'/envelope.raw.json');if(!r.ok)throw Error('The recorded example could not be loaded. Please retry.');samples[name]=parseLossless(await r.text());}
 return samples[name];
}
function selectSample(name){for(const n of ['fee','stealth']){const active=name==='capture-'+n;$('sample-'+n).classList.toggle('active',active);$('sample-'+n).setAttribute('aria-pressed',String(active));}}
async function load(name){
 const attempt=++loadGeneration;setStatus('Loading recorded example…');
 try{const doc=await getSample(name);if(attempt!==loadGeneration)return;current=doc;selectSample(name);provenance(doc,name==='capture-fee'?'Public fee payment':'Stealth transfer','Archived Esmeralda · 21 Oct 2026 · pre-reset, explorer may no longer retain it');inspect();}
 catch(e){if(attempt!==loadGeneration)return;current=null;clearReport();setStatus(e.message,true);}
}
$('sample-fee').onclick=()=>load('capture-fee');$('sample-stealth').onclick=()=>load('capture-stealth');$('inspect').onclick=inspect;
$('tx-form').onsubmit=async e=>{
 e.preventDefault();const id=$('transaction-id').value.trim();
 if(!/^[a-f0-9]{64}$/.test(id)){setStatus('Enter the full 64-character transaction ID, or choose an example below.',true);$('transaction-id').focus();return;}
 const attempt=++loadGeneration;$('fetch-transaction').disabled=true;setStatus('Fetching the public transaction from the mainnet indexer…');
 try{const response=await fetch('https://indexer-a.ootle.tari.com/transactions/'+id,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(response.status===404?'This transaction was not found on the mainnet indexer.':'Indexer returned HTTP '+response.status+'.');
 const raw=await response.text();const doc=parseLossless(raw);if(doc?.transaction?.transaction_id!==id)throw Error('The indexer returned a different or missing transaction ID.');if(attempt!==loadGeneration)return;
 current=doc;selectSample(null);provenance(doc,'Public mainnet transaction','Mainnet · fetched now');inspect();
 }catch(e){if(attempt!==loadGeneration)return;current=null;clearReport();setStatus(e.name==='TimeoutError'?'The indexer did not respond in time. Try a recorded example, or import transaction JSON.':e.message==='Failed to fetch'?'The browser could not reach the indexer. Try a recorded example, or import the JSON file.':e.message,true);}
 finally{$('fetch-transaction').disabled=false;}
};
$('upload').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;const attempt=++loadGeneration;
 try{if(file.size>5_000_000)throw Error('Choose a JSON file smaller than 5 MB.');const doc=parseLossless(await file.text());if(attempt!==loadGeneration)return;current=doc;selectSample(null);provenance(doc,file.name,'Local import · unverified');inspect();}
 catch(err){current=null;clearReport();setStatus('Import failed: '+err.message,true);}
};
$('download').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=el('a','');a.href=url;a.download='specter-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('receipt-export').onclick=async()=>{
 try{
  if(!report)throw Error('Inspect a mainnet transaction first.');
  const bundle=await reportCommitment(report,current?.transaction?.transaction_id);
  latestBundle=bundle;document.dispatchEvent(new CustomEvent('specter:commitment',{detail:bundle}));
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}));
  const a=el('a','');a.href=url;a.download='specter-commitment-'+bundle.reportSha256.slice(0,12)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('receipt-status').textContent='Commitment exported. SHA-256: '+bundle.reportSha256+'. Nothing was submitted on-chain.';
 }catch(e){$('receipt-status').textContent=e.message;}
};
async function compare(){
 try{setStatus('Comparing the two recorded examples…');const [l,r]=await Promise.all([getSample('capture-fee'),getSample('capture-stealth')]);const c=compareReports(analyze(l),analyze(r));const box=$('comparison-table');box.replaceChildren();const table=el('table',''),head=el('tr','');
 ['Visible information','Public fee example','Stealth example'].forEach(v=>head.append(el('th',v)));table.append(head);
 for(const f of c.rules){const row=el('tr','');[(labels[f.rule]||[f.rule])[0],f.left?f.left+' observed':'Not observed',f.right?f.right+' observed':'Not observed'].forEach(v=>row.append(el('td',v)));table.append(row);}box.append(table,el('p','“Not observed” applies only to the selected fields. Neither transaction receives an anonymity verdict.'));
 $('comparison').hidden=false;$('comparison').scrollIntoView({behavior:'smooth',block:'start'});setStatus('Examples compared. These are different flows, not a controlled before/after test.');
 }catch(e){setStatus(e.message,true);}
}
function navigate(name){document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('selected',n.id==='nav-'+name));$('page-name').textContent=name==='inspect'?'Transaction inspector':name==='compare'?'Compare examples':name==='lab'?'Guided fee test':'Your wallet';}
$('nav-inspect').onclick=()=>{navigate('inspect');$('transaction-id').focus();window.scrollTo({top:0,behavior:'smooth'});};
$('nav-compare').onclick=()=>{navigate('compare');compare();};
$('nav-wallet').onclick=()=>{navigate('wallet');openWallet();};
$('nav-lab').onclick=()=>{navigate('lab');$('guided-lab').scrollIntoView({behavior:'smooth'});};
function state(type,label,message){
 $('connection-state').className='connection-state '+type;$('connection-label').textContent=label;$('wallet-message').textContent=message;
 $('wallet-open').classList.toggle('pending',type==='pending');
}
function disconnected(message='Your wallet is not connected. You can still inspect public transactions.'){
 walletState=null;$('wallet-header').textContent='Connect wallet · Not connected';$('wallet-open').classList.remove('connected','pending');$('wallet-inline').textContent=message;
 $('lookup').disabled=true;$('lookup').textContent='Connect using the header first';$('account-details').hidden=true;$('disconnect').hidden=true;$('use-wallet-account').disabled=true;$('result-box').hidden=true;$('result').textContent='';
 $('wallet-title').textContent='Connect your Tari wallet';$('wallet-symbol').classList.remove('connected');$('connect').hidden=false;$('connect').disabled=false;$('connect').textContent='Connect with Tari wallet →';
}
function showConnected(s){
 walletState=s;const account=s.accounts[0],network=s.network;const wrong=network!=='mainnet';
 $('wallet-header').textContent='Connected · '+short(account);$('wallet-open').classList.add('connected');$('wallet-open').classList.remove('pending');$('wallet-title').textContent='Your wallet is connected';$('wallet-symbol').classList.add('connected');
 $('wallet-inline').textContent='Connected to '+short(account)+' · '+network+'. Your keys and private balance stay in your wallet.';
 $('connected-account').textContent=account;$('connected-network').textContent=network+(wrong?' — switch to Mainnet in Sapient':'');
 $('connected-lookup').textContent=s.capabilities?.transactionResultLookup?'Available':'Not available for this account';
 $('account-details').hidden=false;$('disconnect').hidden=false;$('connect').hidden=true;$('recheck').hidden=false;$('wallet-help').hidden=true;
 $('lookup').disabled=wrong||!s.capabilities?.transactionResultLookup;$('lookup').textContent=wrong?'Switch wallet to Mainnet':s.capabilities?.transactionResultLookup?'Look up through my wallet':'Wallet lookup unavailable';
 $('use-wallet-account').disabled=!/^component_[a-f0-9]{64}$/.test(account);
 state('connected','Connected · '+network,wrong?'The connection worked, but wallet lookup is for mainnet. Switch networks in Sapient before looking up a mainnet transaction. The guided payment experiment remains testnet-only.':s.limited?'Your account is connected. Capability checks did not complete; try checking the connection again.':'Connection confirmed. Your public account and network are shown below. No signing, spending, or private view access was requested.');
}
function openWallet(){
 if(!dialog.open)dialog.showModal();
 if(walletState){showConnected(walletState);return;}
 $('recheck').hidden=false;$('wallet-help').hidden=reader.available();
 if(!reader.available()){state('error','Tari wallet not detected','Sapient is not available in this browser tab. If you installed it in Chrome, open this same URL in that Chrome browser.');$('connect').textContent='Try detecting wallet again';}
 else state('','Ready to connect','Click Connect, then approve this site in the Sapient popup. If it does not open, use the extension icon to unlock your wallet.');
}
$('wallet-open').onclick=openWallet;$('wallet-close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
async function restore(visible=false){
 if(connecting)return;const attempt=++uiGeneration;
 try{const s=await reader.restore();if(attempt!==uiGeneration)return;if(s)showConnected(s);else{disconnected();if(visible){$('wallet-help').hidden=!reader.available()?false:true;state('','Not connected','No approved account was returned. Unlock Sapient and choose Connect to approve this site.');}}}
 catch(e){if(attempt!==uiGeneration)return;disconnected();if(visible)state('error','Connection could not be checked',e.message);}
}
$('connect').onclick=async()=>{
 if(connecting)return;
 if(!reader.available()){openWallet();return;}
 connecting=true;const attempt=++uiGeneration;$('connect').disabled=true;$('recheck').disabled=true;$('connect').textContent='Waiting for Sapient…';$('wallet-header').textContent='Waiting for wallet approval';$('wallet-help').hidden=false;
 state('pending','Approval pending in Sapient','Open the Sapient popup and approve the connection. If the popup is missing, click the extension icon and unlock the wallet. This step does not send any funds.');
 try{const s=await reader.connect();if(attempt!==uiGeneration)return;showConnected(s);}
 catch(e){if(attempt!==uiGeneration)return;disconnected();const missing=/unavailable|no tari provider|not running inside/i.test(e.message);state(e.code===4001?'':'error',e.code===4001?'Connection declined':missing?'No wallet found in this tab':'Not connected',e.code===4001?'You declined the request. You can still inspect examples, or reconnect whenever you are ready.':missing?'Open Specter in the Chrome browser where you installed Sapient, unlock the extension, then connect again. The built-in chat browser cannot use your Chrome extension.':e.message);$('wallet-help').hidden=false;}
 finally{connecting=false;$('connect').disabled=false;$('recheck').disabled=false;if(!walletState)$('connect').textContent='Try connecting again';}
};
$('recheck').onclick=()=>restore(true);
$('disconnect').onclick=async()=>{try{await reader.disconnect();uiGeneration++;disconnected();window.dispatchEvent(new Event('specter:wallet-invalidated'));state('','Disconnected','This site has disconnected from your wallet. Public inspection still works.');}catch(e){disconnected();window.dispatchEvent(new Event('specter:wallet-invalidated'));state('error','Local connection cleared','Check Connected sites in Sapient to revoke permission there. '+e.message);}};
$('copy-account').onclick=async()=>{if(!walletState)return;try{await navigator.clipboard.writeText(walletState.accounts[0]);$('copy-account').textContent='Account address copied ✓';}catch{$('copy-account').textContent='Select the address above to copy it';}};
$('use-wallet-account').onclick=()=>{if(!walletState)return;$('account').value=walletState.accounts[0];inspect();};
$('lookup').onclick=async()=>{
 const attempt=uiGeneration;try{$('lookup').disabled=true;$('lookup-status').textContent='Reading the execution result…';$('result-box').hidden=true;
 const r=await reader.lookup($('wallet-txid').value.trim());if(attempt!==uiGeneration)return;$('result').textContent=JSON.stringify(r.data,null,2);
 $('result-box').hidden=false;$('result-box').open=true;const f=r.data?.result?.Finalized;
 $('lookup-status').textContent=f?'Wallet lookup succeeded · indexer-reported '+f.final_decision+'. This result is separate from the signed envelope above.':r.data?.result==='Pending'?'The wallet reports this transaction is still pending.':'Wallet response received. Expand it to inspect the result.';
 }catch(e){$('lookup-status').textContent=e.message;}
 finally{if(walletState)showLookupButton();}
};
function showLookupButton(){const n=walletState.network;const ok=n==='mainnet';$('lookup').disabled=!ok||!walletState.capabilities?.transactionResultLookup;}
function invalidate(){uiGeneration++;reader.invalidate();connecting=false;disconnected('Your wallet account changed. Check the connection before continuing.');window.dispatchEvent(new Event('specter:wallet-invalidated'));state('','Account changed','Reconnect or check your connection to continue.');}
window.addEventListener('tari#accountsChanged',invalidate);
let subscribedProvider;
function listen(){const p=window.tari;if(p&&p!==subscribedProvider){subscribedProvider=p;p.on?.('accountsChanged',invalidate);}}
window.addEventListener('tari#initialized',()=>{listen();restore();});listen();restore();loadMainnetExample();

async function loadMainnetExample(){
 const attempt=++loadGeneration;
 try{const r=await fetch('evidence/mainnet-publish/envelope.raw.json');if(!r.ok)throw Error('Recorded mainnet example unavailable');const doc=parseLossless(await r.text());if(attempt!==loadGeneration)return;current=doc;selectSample(null);provenance(doc,'Mainnet template publication','Mainnet · recorded 11 Nov 2026');inspect();}
 catch(e){setStatus(e.message,true);}
}
$('sample-mainnet').onclick=loadMainnetExample;
