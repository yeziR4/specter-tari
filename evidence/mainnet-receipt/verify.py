import base64, hashlib, json
from pathlib import Path
import cbor2

root=Path(__file__).parent
load=lambda name: json.loads((root/name).read_text(encoding='utf-8-sig'))
bundle=load('commitment.json')
assert hashlib.sha256((root/'report.json').read_bytes()).hexdigest()==bundle['reportSha256']
envelope=load('envelope.raw.json')['transaction']
txid='46a39f9bb07b89a130d44ff4415aebedfabdf6c9f89c16f714b948cb429a7391'
assert envelope['transaction_id']==txid
assert envelope['summary']['outcome']=='Commit'
result=load('result.raw.json')['result']['Finalized']
assert result['final_decision']=='Commit'
decoded=cbor2.loads(base64.b64decode(load('substate.json')['state']['up']['substate']))
def lists(value):
    if isinstance(value,list):
        yield value
        for item in value: yield from lists(item)
state=next(x for x in lists(decoded) if len(x)==4 and x[0]==bundle['reportSha256'])
assert state[1]==bundle['transactionId']
assert state[2].hex()=='da8b317049487cc2097430891b3d6761c6d693e61bdd7ee3ccc2e0f3c17f222c'
assert state[3]==38462
instructions=envelope['transaction']['V1']['body']['transaction']['instructions']
methods=[i['CallMethod']['method'] for i in instructions if isinstance(i,dict) and 'CallMethod' in i]
assert methods==['report_hash','transaction_id','author','recorded_epoch','schema_version']
verification={
 'status':'stored-fields-match-and-getter-calls-committed','network':'mainnet',
 'receiptTransaction':txid,
 'receiptComponent':'component_49f15c537fbec61d852175fd74a41027362167ccd1b87b0b0ef15074b241c078',
 'templateAddress':'9b41600aec8aaefb3c66e00567a060cafbb1e51fb4a904074f4faaabff6cb725',
 'reportSha256':state[0],'inspectedTransaction':state[1],
 'author':state[2].hex(),'recordedEpoch':state[3],
 'getterCallsCommitted':methods,'feeMicroTari':envelope['summary']['total_fees_paid'],
 'finalizedUtc':envelope['summary']['finalized_at'],
 'duplicateReceipts':['121ac88afb41fb6edad0da2bc76a6914eb73f41109d31745965081fa38b80123','8b6008fa5a0254b0668d4eccff4bab36697ac957d7a8e962946f168425108ecd'],
 'limitations':'Single public indexer responses; no independent signature, Merkle-proof or consensus-proof verification. Stored fields decoded and checked; getter invocation success checked, individual returned values are not exposed in the persisted result. A commitment does not certify report correctness or anonymity.'
}
verification['filesSha256']={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['report.json','envelope.raw.json','result.raw.json','substate.json']}
(root/'verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
print(json.dumps(verification,indent=2))
