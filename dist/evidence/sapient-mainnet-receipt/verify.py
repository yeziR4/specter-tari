import base64, hashlib, json
from pathlib import Path
import cbor2
root=Path(__file__).parent
load=lambda name:json.loads((root/name).read_text(encoding='utf-8-sig'))
bundle=load('commitment.json')
expected='0f4457fa78730ef2ec3672c43b095b6d6943513e692327dfdd356e190ebc0a92'
assert hashlib.sha256((root/'report.json').read_bytes()).hexdigest()==expected
e=load('envelope.raw.json')['transaction']
assert e['transaction_id']=='4dbb50e413ab7c0c51deb0cfa146950936f06d2a9fb2ddd27f44844fc4941776'
assert e['summary']['outcome']=='Commit'
r=load('result.raw.json')['result']['Finalized']
assert r['final_decision']=='Commit'
sub=cbor2.loads(base64.b64decode(load('substate.raw.json')['state']['up']['substate']))
def lists(v):
 if isinstance(v,list):
  yield v
  for x in v:yield from lists(x)
state=next(x for x in lists(sub) if len(x)==4 and x[0]==expected)
assert state[1]==bundle['transactionId']=='018c99cfbd234d88d4a3664da505f8bc2a9a09d7c65f574ac1f68b19a6ef6a6c'
assert state[2].hex()=='c0228454ee12a8cbc4f6126517194f7fb5a9b54bfd9fe3eb664153e36b99341c'
assert state[3]==38477
call=e['transaction']['V1']['body']['transaction']['instructions'][0]['CallFunction']
assert call['address']=='9b41600aec8aaefb3c66e00567a060cafbb1e51fb4a904074f4faaabff6cb725'
assert call['function']=='commit'
assert cbor2.loads(bytes.fromhex(call['args'][0]['Literal']))==expected
assert cbor2.loads(bytes.fromhex(call['args'][1]['Literal']))==state[1]
v={'network':'mainnet','flow':'Specter -> Sapient approval -> Specter submit -> indexer Commit','requestId':'278cad44-d05b-4dcf-b9e6-471013d0d4d7','transactionId':e['transaction_id'],'component':'component_1a17cec41b6c0fb5a50ef457a87fa16a10e2f5da10bdbe5d18038bad3063111e','reportSha256':state[0],'inspectedTransaction':state[1],'signer':state[2].hex(),'epoch':state[3],'feeMicroTari':e['summary']['total_fees_paid'],'finalizedUtc':e['summary']['finalized_at'],'status':'stored receipt matches exported report and approved commit instruction','limitation':'Checked public indexer responses and decoded public component state; no independent verification of signatures or consensus proofs. Hash commitment does not certify report accuracy or anonymity.'}
v['filesSha256']={n:hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ['envelope.raw.json','result.raw.json','substate.raw.json','report.json']}
(root/'verification.json').write_text(json.dumps(v,indent=2),encoding='utf-8')
print(json.dumps(v,indent=2))
