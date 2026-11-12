// A deliberately narrow assertion: explicit declared component inputs and direct call targets.
// This does not inspect CBOR args, arbitrary contract state, signers or hidden ownership.
export function referencePolicy(document, knownAccount) {
  if(!/^component_[a-f0-9]{64}$/.test(knownAccount||''))throw Error('A full known component address is required.');
  const candidates=[['$.transaction.transaction.V1.body.transaction',document?.transaction?.transaction?.V1?.body?.transaction],['$.transaction.V1.body.transaction',document?.transaction?.V1?.body?.transaction],['$.V1.body.transaction',document?.V1?.body?.transaction]];
  const [root,tx]=candidates.find(([,t])=>t&&typeof t==='object')||[];
  const report={format:'specter-reference-policy-v1',scope:'Declared component input addresses and direct CallMethod/UpdateComponentTemplate targets only',knownAccount,status:'inconclusive',matches:[],unknowns:[],limitation:'Not a claim of anonymity, ownership, proof validity, or absence from encoded arguments, nested contract execution, logs, outputs or signatures.'};
  if(!tx){report.unknowns.push('Signed V1 envelope not found.');return report;}
  if(!Array.isArray(tx.inputs))report.unknowns.push('Declared input array missing.');
  else tx.inputs.forEach((input,i)=>{
    if(typeof input?.substate_id!=='string'){report.unknowns.push('Invalid declared input at '+i);return;}
    if(input.substate_id===knownAccount)report.matches.push({path:root+'.inputs['+i+'].substate_id',value:knownAccount});
  });
  for(const stage of ['fee_instructions','instructions']) {
    if(!Array.isArray(tx[stage])){report.unknowns.push(stage+' missing.');continue;}
    tx[stage].forEach((instruction,i)=>{
      const path=root+'.'+stage+'['+i+']';
      if(instruction==='DropAllProofsInWorkspace')return;
      if(!instruction||typeof instruction!=='object'||Array.isArray(instruction)||Object.keys(instruction).length!==1){report.unknowns.push(path+': invalid instruction');return;}
      const kind=Object.keys(instruction)[0];
      if(['CallMethod','UpdateComponentTemplate'].includes(kind)){
        const ref=kind==='CallMethod'?instruction[kind]?.call:instruction[kind]?.component;
        if(ref?.Address===knownAccount)report.matches.push({path:path+'.'+kind+(kind==='CallMethod'?'.call.Address':'.component.Address'),value:knownAccount});
        if(typeof ref?.Address!=='string')report.unknowns.push(path+': indirect or missing component target');
      }else if(!['CreateAccount','CallFunction','PutLastInstructionOutputOnWorkspace','ClaimBurn','ClaimValidatorFees','Assert','TakeFromBucket','PublishTemplate','AllocateAddress','StealthTransfer','PayFeeFromBucket','PutIntoBucket'].includes(kind))report.unknowns.push(path+': unsupported '+kind);
    });
  }
  report.status=report.matches.length?'violated':report.unknowns.length?'inconclusive':'satisfied-in-scope';
  return report;
}

export function controlledComparison(publicCapture,privateCapture,account) {
  const publicPolicy=referencePolicy(publicCapture.envelope,account),privatePolicy=referencePolicy(privateCapture.envelope,account);
  const pairs=[publicCapture,privateCapture];
  const id=c=>c.envelope?.transaction?.transaction_id;
  const decisions=pairs.map(c=>c.result?.result?.Finalized);
  const valid=pairs.every((c,i)=>c.envelope?.transaction?.transaction?.V1?.body?.transaction?.network===38&&/^[a-f0-9]{64}$/.test(id(c)||'')&&decisions[i]?.final_decision==='Commit'&&decisions[i]?.execution_result?.finalize?.transaction_hash===id(c));
  const status=!valid||id(publicCapture)===id(privateCapture)?'inconclusive':publicPolicy.status==='violated'&&privatePolicy.status==='satisfied-in-scope'?'reference-reduced-in-scope':'expected-difference-not-established';
  return {format:'specter-controlled-comparison-v1',status,transactionIds:pairs.map(id),publicPolicy,privatePolicy,limitation:'Result IDs and indexer-reported Commit are checked, not signatures or consensus proofs. Equal private payment terms come from the local requested operations, not public proof of hidden amounts or recipients. Public fees, timing, graph links and other metadata may remain.'};
}
