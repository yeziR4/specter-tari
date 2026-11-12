import {verifyCapture} from './verify-capture.mjs';
import {referencePolicy} from './reference-policy.mjs';
try{
  const [directory,knownAccount]=process.argv.slice(2);
  if(!directory||!knownAccount)throw Error('Usage: node src/reference-cli.mjs <capture-directory> <known-component-address>');
  const capture=await verifyCapture(directory);const report=referencePolicy(capture.envelope,knownAccount);
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.status==='violated'?2:report.status==='inconclusive'?3:0;
}catch(e){console.error(e.message);process.exitCode=1;}
