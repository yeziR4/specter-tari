// Only account connection, capabilities and execution-result lookup. No spend API.
export function walletReader(getProvider=()=>globalThis.window?.tari, {timeoutMs=30000}={}) {
  let connected=false, generation=0;
  const provider=()=>{const p=getProvider();if(!p?.request)throw Error('Open with Sapient or Tari Universe. No Tari provider is available.');return p;};
  const request=async(p,args)=>{
    let timer;
    try{return await Promise.race([p.request(args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The wallet has not replied. Open the Sapient extension, unlock it, and check for a pending request.')),timeoutMs);})]);}
    finally{clearTimeout(timer);}
  };
  async function details(p,accounts,attempt){
    const [caps,net]=await Promise.allSettled([request(p,{method:'tari_getCapabilities'}),request(p,{method:'tari_getNetwork'})]);
    if(attempt!==generation)throw Error('Wallet connection changed. Please reconnect.');
    connected=true;
    return {accounts,capabilities:caps.status==='fulfilled'?caps.value:{},network:net.status==='fulfilled'&&typeof net.value==='string'?net.value:'unknown',limited:caps.status==='rejected'};
  }
  return {
    available(){return !!getProvider()?.request;},
    async restore(){
      const attempt=++generation;connected=false;
      if(!getProvider()?.request)return null;
      const p=provider();const accounts=await request(p,{method:'tari_getAccounts'});
      if(!Array.isArray(accounts)||!accounts.length)return null;
      return details(p,accounts,attempt);
    },
    async connect() {
      const attempt=++generation;connected=false;
      const p=provider();
      const accounts=await request(p,{method:'tari_requestAccounts'});
      if(attempt!==generation)throw Error('Wallet connection changed. Please reconnect.');
      if(!Array.isArray(accounts)||!accounts.length)throw Error('No account connected.');
      return details(p,accounts,attempt);
    },
    invalidate(){connected=false;generation++;},
    async disconnect(){generation++;connected=false;await request(provider(),{method:'tari_disconnect'});},
    async lookup(transactionId) {
      if(!/^[a-f0-9]{64}$/.test(transactionId))throw Error('Enter a full transaction ID.');
      if(!connected)throw Error('Connect the wallet first.');
      const p=provider();
      const caps=await request(p,{method:'tari_getCapabilities'});
      if(!caps?.transactionResultLookup)throw Error('This account does not support transaction-result lookup.');
      const attempt=generation;
      const result=await request(p,{method:'tari_getTransactionResult',params:{transactionId}});
      if(attempt!==generation)throw Error('Wallet changed during lookup. Reconnect and try again.');
      return {kind:'execution-result-only',data:result,limitation:'Not a signed transaction envelope. Instruction inspection needs the separately captured envelope.'};
    }
  };
}
