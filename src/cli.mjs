import { readFile } from 'node:fs/promises';
import { analyze, evaluatePolicy } from './analyze.mjs';
import { parseLossless } from './json.mjs';
try {
  const [file, ...accounts] = process.argv.slice(2);
  if (!file) throw Error('Usage: node src/cli.mjs transaction.json [known_component_address ...]');
  const raw = await readFile(file, 'utf8');
  if (Buffer.byteLength(raw) > 5_000_000) throw Error('Input exceeds 5 MB.');
  const report = analyze(parseLossless(raw), { knownAccounts: accounts });
  report.policy = evaluatePolicy(report, { forbid: ['KNOWN_ACCOUNT_REFERENCE'] });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.policy.status === 'violated' ? 2 : 3;
} catch (e) { console.error(e.message); process.exitCode = 1; }
