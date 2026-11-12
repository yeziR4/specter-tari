const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
export const RECEIPT_DEPLOYMENT=Object.freeze({network:'mainnet',templateAddress:'9b41600aec8aaefb3c66e00567a060cafbb1e51fb4a904074f4faaabff6cb725',publicationTransaction:'198f98d7ce75568702c9c3906f1419cf3fb9f53487e05ed829a9e56b6a2c021c',finalizedUtc:'2026-11-11T14:12:54Z'});
export function literalHash(value){
  if(!hex64(value))throw Error('Expected 64 lowercase hexadecimal characters.');
  return {Literal:'7840'+Array.from(value,c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')};
}
export function receiptOperation(templateAddress,digest,transactionId){
  const address=templateAddress?.replace(/^template_/,'');
  if(!hex64(address))throw Error('A verified template address is required.');
  return {kind:'instructions',instructions:[{CallFunction:{address,function:'commit',args:[literalHash(digest),literalHash(transactionId)]}}],maxFee:'100000',feeType:'private',enforceFeeType:true};
}
export function receiptManifest(bundle){
  if(bundle?.network!=='mainnet'||!hex64(bundle.reportSha256)||!hex64(bundle.transactionId))throw Error('A mainnet report commitment is required.');
  const code=`use template_${RECEIPT_DEPLOYMENT.templateAddress} as SpecterReportReceipt;\nfn main() {\n    let receipt = SpecterReportReceipt::commit("${bundle.reportSha256}", "${bundle.transactionId}");\n    receipt.report_hash();\n    receipt.transaction_id();\n    receipt.author();\n    receipt.recorded_epoch();\n    receipt.schema_version();\n}\n`;
  return [{name:'Specter report receipt',code,variables:{},signingKeys:[],blobs:{}}];
}
export async function reportCommitment(report,transactionId,cryptoApi=globalThis.crypto){
  if(report?.network!=='mainnet'||!hex64(transactionId))throw Error('Choose a mainnet transaction with a full transaction ID.');
  const reportText=JSON.stringify(report,null,2);
  const bytes=new TextEncoder().encode(reportText);
  const digest=Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  return {format:'specter-report-commitment-v1',network:'mainnet',transactionId,reportSha256:digest,reportBytes:bytes.length,reportText,contract:'SpecterReportReceipt',deployment:RECEIPT_DEPLOYMENT,limits:'A hash commitment does not verify report accuracy, transaction existence or anonymity. Receipt author and transaction link are public.'};
}
export function receiptClient(getProvider=()=>globalThis.window?.tari){
 async function identity(expected){
  const p=getProvider();if(!p?.request)throw Error('Open Specter in Chrome with Sapient installed and connect using the header.');
  const [accounts,network]=await Promise.all([p.request({method:'tari_getAccounts'}),p.request({method:'tari_getNetwork'})]);
  if(network!=='mainnet')throw Error('Switch Sapient to mainnet. Receipt requests refuse testnet and unknown networks.');
  const account=accounts?.[0];if(!/^component_[a-f0-9]{64}$/.test(account||''))throw Error('Connect a mainnet account using the header.');
  if(expected&&account!==expected)throw Error('Wallet account changed. Restore the account used for this request.');
  return {p,account};
 }
 function validate(record){
  if(!record?.requestId||!hex64(record.reportSha256)||!hex64(record.transactionId))throw Error('Invalid saved receipt request.');
  const expected=receiptOperation(RECEIPT_DEPLOYMENT.templateAddress,record.reportSha256,record.transactionId);
  if(JSON.stringify(expected)!==JSON.stringify(record.operation))throw Error('Saved receipt operation changed. Submission refused.');
 }
 return {
  async create(bundle){
   if(bundle?.network!=='mainnet'||!hex64(bundle.reportSha256)||!hex64(bundle.transactionId))throw Error('Export a valid mainnet report first.');
   const {p,account}=await identity();const caps=await p.request({method:'tari_getCapabilities'});
   if(!caps?.transactionRequests||!caps?.supportsPrivateFees)throw Error('This wallet must support transaction requests and enforced private fees.');
   const operation=receiptOperation(RECEIPT_DEPLOYMENT.templateAddress,bundle.reportSha256,bundle.transactionId);
   const response=await p.request({method:'tari_createTransactionRequest',params:operation});
   if(typeof response?.requestId!=='string'||!response.requestId)throw Error('No request ID returned. Check Sapient pending requests before retrying.');
   return {requestId:response.requestId,account,reportSha256:bundle.reportSha256,transactionId:bundle.transactionId,operation,createdAt:new Date().toISOString(),submissionAttempted:false};
  },
  async check(record){validate(record);const {p}=await identity(record.account);return p.request({method:'tari_getTransactionRequest',params:{requestId:record.requestId}});},
  async submit(record){
   validate(record);const {p}=await identity(record.account);const status=await this.check(record);
   if(status.status==='submitted')return status.result;
   if(record.submissionAttempted)throw Error('Submission was already attempted. Recover its status; do not create a duplicate.');
   if(status.status!=='approved')throw Error('Request is '+status.status+'. Approve it in Sapient first.');
   return p.request({method:'tari_submitTransactionRequest',params:{requestId:record.requestId}});
  }
 };
}
