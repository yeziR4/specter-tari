# Specter — Tari Privacy Lab

Live app: https://yezir4.github.io/specter-tari/

Specter inspects selected public transaction fields and optionally anchors exported report hashes on Tari Ootle mainnet. The project began as an October 2026 prototype; November additions include a deployed receipt contract, mainnet inspection, Sapient approval/submission recovery, developer-wallet exports, and recorded live evidence. It is a scoped inspection tool, not a complete privacy audit.

Live Sapient evidence: https://yezir4.github.io/specter-tari/sapient-proof.html

Contract publication and verification details: [MAINNET-RELEASE.md](MAINNET-RELEASE.md). Source and contract are MIT licensed. Development used AI coding assistance under the author's direction.

## Original prototype notes

## Run

From this directory, using Node 20 or newer:

```powershell
node --test
node src/cli.mjs fixtures/live-fee-observation.json
```

Optional: append full known component addresses to check exact matches. Known references are supplied by the caller; the tool does not infer the owner of an account.

CLI exit codes: 1 input/usage error, 2 forbidden observation found, 3 inconclusive. There is deliberately no privacy-pass exit code yet.

## Progress update: complete direct captures

Two complete transaction envelopes and matching execution results have now been downloaded directly from the documented public indexer REST endpoints. Each archive has a manifest containing source URL, capture time, byte length and SHA-256 digest:

- evidence/capture-fee: 3ef1a1193ffc0cb38ef1daa6278c7f36f77954e1b4e905171c3a8fa031c0b223
- evidence/capture-stealth: 877b3e4dba21ce4f6fcb54d50802de87d3a4991399b3078f483bcd77f0718442

Both indexer responses report Commit. Integrity checks verify local bytes and agreement of returned transaction IDs, not signatures or consensus finality. The second transaction has a fee-stage revealed output amount and stealth output counts; it does not trigger a public pay_fee component call finding. These are unrelated transactions, NOT a controlled before/after improvement.

```powershell
node src/compare-cli.mjs evidence/capture-fee evidence/capture-stealth
node src/capture.mjs <transaction-id> <new-archive-directory>
```

The capture script performs only two public GET requests to the fixed Tari indexer origin, refuses overwriting an archive, and records original bytes. The lossless importer preserves unsafe-size integers as strings, including the first envelope's exact nonce, 7303555905965440489. Findings are based on selected instruction fields; this is not complete schema validation.

There are now 41 passing tests, including archive tamper rejection and the wallet adapter's read-only API boundary.

The Sapient source handler in src/background/index.ts (Git blob 44f751ea779b53b375afe30b0b073c3925b82d31, retrieved 21 October 2026) delegates tari_getTransactionResult to provider.getTransactionResult after checking the site connection. The corresponding indexer response type is an execution result, not the signed envelope. src/wallet.mjs implements this read-only interaction with capability checks and explicit invalidation. Unit tests use a fake provider; a real extension interaction is still pending.

https://github.com/chironbuilds/tari-wallet/blob/master/src/background/index.ts
https://github.com/tari-project/tari-ootle/blob/9f6c04e9107b03d22618d88339e27dd37b1f0c46/clients/tari_indexer_client/src/rest_api_client.rs

## What works

- Inspect fee and main instruction arrays separately.
- Report public component calls, fee-stage pay_fee targets, caller-supplied known account matches, revealed stealth input/output amounts, output counts and public value floors.
- Attach source-field paths and explanations to every finding.
- Preserve raw-unit amounts with BigInt; reject unsafe JSON numeric amounts.
- Report missing data and unsupported instructions as unknown.
- Fail a requested known-account policy when positive evidence establishes a match.

Automated tests cover captured observations, complete downloaded envelopes and synthetic adverse cases. Synthetic test envelopes are structural fixtures, not valid signed network transactions. No cryptographic validity is asserted.

## Real evidence and its limits

Observed live through Veil on 21 October:

https://explorer.tari.mw/tx/3ef1a1193ffc0cb38ef1daa6278c7f36f77954e1b4e905171c3a8fa031c0b223

The explorer reported Commit and exposed a fee-stage CallMethod to pay_fee at component_ae57fb3f8deb34cef1ed966bbe33934cae9c2509c073155b9ca0231f6eabca71. The Raw transaction JSON tree was expanded to confirm the method and Address reference. The fixture is an explicitly partial manual transcription of those fields. It is not the full API response, a verified signature, an independently verified finality proof, or a claim that this application's privacy was defective. No ownership or intended privacy policy was established.

The original partial transcription is retained as historical evidence. Complete direct captures supersede its data-access limitation. The full product gate is still open: no controlled lower-leakage counterpart or real extension lookup has yet been verified.

An older Ghostline transaction linked in public project evidence returned “not known to this indexer.” It is not used as verified live evidence.

## Source pin and compatibility

Official type definitions are archived in evidence/schema from tari-project/tari-ootle commit 9f6c04e9107b03d22618d88339e27dd37b1f0c46:

https://github.com/tari-project/tari-ootle/tree/9f6c04e9107b03d22618d88339e27dd37b1f0c46/bindings/src/types

Upstream project is BSD-3-Clause; see evidence/UPSTREAM-LICENSE for the archived licence. Type files retain their generated-source headers. This prototype only implements a subset of those types, not full schema validation. The current explorer transaction uses legacy fields including is_seal_signer_authorized and blob_hashes; only its explicitly observed CallMethod projection is used. Do not claim compatibility for every field or deployment version.

## Remaining feasibility work

1. Extend capture verification and schema coverage beyond selected instruction fields.
2. Exercise the read-only Sapient adapter in an actual extension session; source inspection establishes delegation only.
3. Create a user-operated, funded Esmeralda comparison with the same application intent and a narrowly specified privacy requirement.
4. Extend analysis to events, execution diffs, account inputs and signer reuse, with source-backed interpretation.
5. Capture the controlled pair through the guided fee test; the UI labels its narrow scope and does not claim a live result in advance.

The inspector remains read-only. The optional guided fee test creates explicit user-reviewed transaction requests and exposes a separate submit action after wallet approval. It never requests recovery words or private keys. It does not establish anonymity, detect every disclosure, resolve component internals, verify range proofs or identify people.

## Competitive finding

Veil already labels some amount disclosures and displays fee instructions. Specter must distinguish itself through reusable assertions, comparisons, and regression detection rather than duplicating a transaction explorer. Reassess the contest proposition after the full evidence gate.

## Guided fee test (0.0.3)

The published flow compares two user-operated Esmeralda self-payments with enforced fee funding modes, records raw indexer responses, and tests a local account-reference regression. See LAB-RUNBOOK.md for the exact scope, caps, recovery steps and source references. The real funded pair and recipient recovery remain unverified. No on-chain experiment has been executed by the assistant.

