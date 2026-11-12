import {verifyCapture} from './verify-capture.mjs';
import {analyze} from './analyze.mjs';
import {compareReports} from './compare.mjs';
try {
  const [leftDir,rightDir]=process.argv.slice(2);
  if(!leftDir||!rightDir) throw Error('Usage: node src/compare-cli.mjs <left archive> <right archive>');
  const [l,r]=await Promise.all([verifyCapture(leftDir),verifyCapture(rightDir)]);
  const report=compareReports(analyze(l.envelope),analyze(r.envelope));
  report.captures=[l,r].map(x=>({transactionId:x.manifest.transactionId,reportedDecision:x.reportedDecision,integrity:x.integrity,verification:x.verification}));
  console.log(JSON.stringify(report,null,2));
} catch(e){console.error(e.message);process.exitCode=1;}
