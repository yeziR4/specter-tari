export const SOURCE_COMMIT = '9f6c04e9107b03d22618d88339e27dd37b1f0c46';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const address = x => typeof x === 'string' && /^component_[a-f0-9]{64}$/.test(x);
function integer(x) {
  if (typeof x === 'number' && (!Number.isSafeInteger(x) || x < 0)) throw Error('Unsafe or negative amount');
  if (!['string','number','bigint'].includes(typeof x) || !/^\d+$/.test(String(x))) throw Error('Invalid unsigned amount');
  const n = BigInt(x);
  if (n >= (1n << 128n)) throw Error('Amount exceeds u128');
  return n;
}

// A scoped evidence inspector, not a transaction validator or signature verifier.
export function analyze(document, { knownAccounts = [] } = {}) {
  if (!Array.isArray(knownAccounts) || knownAccounts.some(x => !address(x))) throw Error('Known accounts must be full component addresses.');
  const report = { format: 'specter-report-v1', scope: 'unsupported', sourceCommit: SOURCE_COMMIT,
    findings: [], unknowns: [], observedInstructionCount: 0,
    conclusion: 'No conclusion about anonymity, ownership, finality or transaction validity.' };
  const add = (rule, path, value, explanation) => report.findings.push({ rule, status: 'observed', path, value, explanation });
  let tx, root;
  if (document?.format === 'specter-observation-v1') {
    report.scope = 'partial-observation';
    report.provenance = document.provenance;
    report.unknowns.push('Manually transcribed partial evidence; omitted fields are unknown. Provenance is a supplied claim, not cryptographically verified.');
    tx = document.observed;
    root = '$.observed';
  } else {
    const apiWrapped = document?.transaction?.transaction?.V1;
    const wrapped = apiWrapped ? document.transaction.transaction : document?.transaction?.V1 ? document.transaction : document;
    tx = wrapped?.V1?.body?.transaction;
    root = apiWrapped ? '$.transaction.transaction.V1.body.transaction' : document?.transaction?.V1 ? '$.transaction.V1.body.transaction' : '$.V1.body.transaction';
    if (object(tx)) report.scope = 'v1-instruction-fields';
  }
  if (!object(tx)) {
    report.unknowns.push('Unsupported input. Expected V1.body.transaction, transaction.V1.body.transaction, or an explicit partial observation.');
    return report;
  }
  for (const stage of ['fee_instructions','instructions']) {
    if (!Array.isArray(tx[stage])) { report.unknowns.push(`${root}.${stage}: missing or invalid instruction array`); continue; }
    tx[stage].forEach((ins, i) => {
      const path = `${root}.${stage}[${i}]`;
      report.observedInstructionCount++;
      if (!object(ins) || Object.keys(ins).length !== 1) { report.unknowns.push(`${path}: unsupported instruction shape`); return; }
      if (ins.CallMethod) {
        const c = ins.CallMethod;
        if (!object(c) || typeof c.method !== 'string') { report.unknowns.push(`${path}: malformed CallMethod`); return; }
        if (address(c.call?.Address)) {
          const p = `${path}.CallMethod.call.Address`;
          add('PUBLIC_COMPONENT_CALL', p, c.call.Address, `Public component reference for method ${c.method}; does not identify a person.`);
          if (knownAccounts.includes(c.call.Address)) add('KNOWN_ACCOUNT_REFERENCE', p, c.call.Address, 'Exact match to a caller-supplied account reference; ownership is not inferred.');
          if (stage === 'fee_instructions' && c.method === 'pay_fee') add('PUBLIC_FEE_COMPONENT', p, c.call.Address, 'Fee-stage pay_fee targets this public component. This alone does not establish who owns it.');
        } else report.unknowns.push(`${path}.CallMethod.call: workspace or unsupported target; not resolved`);
        report.unknowns.push(`${path}.CallMethod: arguments and executed component internals are not analyzed`);
      } else if (ins.StealthTransfer) {
        const s = ins.StealthTransfer.statement;
        const p = `${path}.StealthTransfer.statement`;
        try {
          const n = integer(s?.inputs_statement?.revealed_amount);
          if (n > 0n) add('REVEALED_INPUT_AMOUNT', `${p}.inputs_statement.revealed_amount`, n.toString(), 'Revealed input amount in raw resource units, not necessarily the payment amount.');
        } catch (e) { report.unknowns.push(`${p}.inputs_statement.revealed_amount: ${e.message}`); }
        const out = s?.outputs_statement;
        if (!object(out) || !Object.hasOwn(out, 'revealed_output')) report.unknowns.push(`${p}.outputs_statement.revealed_output: missing`);
        else if (out.revealed_output !== null) {
          try {
            const n = integer(out.revealed_output?.amount);
            if (n === 0n) throw Error('Zero revealed output is invalid');
            add('REVEALED_OUTPUT_AMOUNT', `${p}.outputs_statement.revealed_output.amount`, n.toString(), 'Revealed output amount; destination depends on subsequent instructions.');
          } catch (e) { report.unknowns.push(`${p}.outputs_statement.revealed_output: ${e.message}`); }
        }
        if (!Array.isArray(out?.outputs)) report.unknowns.push(`${p}.outputs_statement.outputs: missing or invalid`);
        else {
          add('STEALTH_OUTPUT_COUNT', `${p}.outputs_statement.outputs`, out.outputs.length, 'Public output count; a single count does not establish a correlation.');
          out.outputs.forEach((o, j) => {
            const op = `${p}.outputs_statement.outputs[${j}].output.minimum_value_promise`;
            try { const n = integer(o?.output?.minimum_value_promise); if (n > 0n) add('PUBLIC_VALUE_FLOOR', op, n.toString(), 'Public lower bound on this output, not the wallet balance.'); }
            catch(e) { report.unknowns.push(`${op}: ${e.message}`); }
          });
        }
        report.unknowns.push(`${p}: proofs, witness paths, encrypted payloads and output ownership are not verified`);
      } else report.unknowns.push(`${path}: ${Object.keys(ins)[0]} is not analyzed`);
    });
  }
  report.unknowns.push('Signer reuse, input graph, events, state diffs, network metadata and execution finality are outside this prototype.');
  return report;
}

// Only positive evidence can currently decide a policy. Absence is inconclusive.
export function evaluatePolicy(report, { forbid = [] } = {}) {
  return { status: report.findings.some(f => forbid.includes(f.rule)) ? 'violated' : 'unknown',
    explanation: 'No passing verdict is issued from incomplete inspection.' };
}
