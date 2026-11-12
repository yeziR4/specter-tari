export const LAB_CONFIG=Object.freeze({network:'esmeralda',resourceAddress:'resource_'+'01'.repeat(32),amount:'1000',maxFee:'100000'});
const fullAccount=x=>/^component_[a-f0-9]{64}$/.test(x||'');
const fullId=x=>/^[a-f0-9]{64}$/.test(x||'');
export function experimentClient(getProvider=()=>globalThis.window?.tari){
  const provider=()=>{const p=getProvider();if(!p?.request)throw Error('Connect Sapient using the top-right wallet control.');return p;};
  async function identity(expected){
    const p=provider();
    const [accounts,network]=await Promise.all([p.request({method:'tari_getAccounts'}),p.request({method:'tari_getNetwork'})]);
    if(!/^(esmeralda|esme)$/i.test(network||''))throw Error('This test is restricted to Esmeralda. Mainnet and unknown networks are refused.');
    if(!Array.isArray(accounts)||!fullAccount(accounts[0]))throw Error('Connect an Esmeralda account using the header.');
    if(expected&&expected!==accounts[0])throw Error('The wallet account changed. Switch back before continuing this test.');
    return {p,account:accounts[0],network:'esmeralda'};
  }
  return {
    async readiness(){
      const {p,account,network}=await identity();
      const [capabilities,walletAddress,balances]=await Promise.all([p.request({method:'tari_getCapabilities'}),p.request({method:'tari_getWalletAddress'}),p.request({method:'tari_getBalances'})]);
      if(!capabilities?.privateSpend||!capabilities?.transactionRequests||!capabilities?.supportsPrivateFees)throw Error('This wallet version/account does not expose the required private-spend, transaction-request and enforced private-fee support. The test is disabled; no weaker fallback is used.');
      if(typeof walletAddress!=='string'||!walletAddress.startsWith('otl_esm_'))throw Error('The wallet did not return an Esmeralda receiving address.');
      const token=Array.isArray(balances)?balances.find(b=>b.resourceAddress===LAB_CONFIG.resourceAddress):null;
      let revealedEnough=false;
      try{revealedEnough=BigInt(token?.amount??'0')>=BigInt(LAB_CONFIG.maxFee);}catch{}
      return {account,network,walletAddress,capabilities,revealedEnough,privateFunds:'not-read',config:LAB_CONFIG};
    },
    async create(mode,ready){
      if(!['transparent','private'].includes(mode))throw Error('Invalid fee mode.');
      const fresh=await this.readiness();
      if(fresh.account!==ready.account||fresh.walletAddress!==ready.walletAddress)throw Error('Account changed after review; check readiness again.');
      if(mode==='transparent'&&!fresh.revealedEnough)throw Error('The public-fee step needs at least 0.1 test TARI in revealed balance for the fee cap. No request was created.');
      const operation={kind:'sendPrivately',resourceAddress:LAB_CONFIG.resourceAddress,recipientWalletAddress:fresh.walletAddress,amount:LAB_CONFIG.amount,maxFee:LAB_CONFIG.maxFee,feeType:mode,enforceFeeType:true};
      const {p}=await identity(fresh.account);
      const response=await p.request({method:'tari_createTransactionRequest',params:operation});
      if(typeof response?.requestId!=='string'||!response.requestId)throw Error('Wallet did not return a request ID. Check pending requests in Sapient before retrying.');
      return {format:'specter-lab-request-v1',requestId:response.requestId,account:fresh.account,walletAddress:fresh.walletAddress,mode,operation,createdAt:new Date().toISOString(),submissionAttempted:false};
    },
    async check(record){
      const {p}=await identity(record.account);
      if(!record.requestId||typeof record.requestId!=='string')throw Error('No saved wallet request ID.');
      return p.request({method:'tari_getTransactionRequest',params:{requestId:record.requestId}});
    },
    async submit(record){
      if(!['transparent','private'].includes(record.mode)||!fullAccount(record.account))throw Error('Invalid saved request.');
      const {p}=await identity(record.account);const status=await this.check(record);
      if(status.status==='submitted')return {alreadySubmitted:true,result:status.result};
      if(status.status!=='approved')throw Error('Wallet request is '+status.status+'. Only an approved request can be submitted.');
      if(JSON.stringify(record.operation)!==JSON.stringify({kind:'sendPrivately',resourceAddress:LAB_CONFIG.resourceAddress,recipientWalletAddress:record.walletAddress,amount:LAB_CONFIG.amount,maxFee:LAB_CONFIG.maxFee,feeType:record.mode,enforceFeeType:true}))throw Error('Saved operation changed; submission refused.');
      return {alreadySubmitted:false,result:await p.request({method:'tari_submitTransactionRequest',params:{requestId:record.requestId}})};
    }
  };
}
