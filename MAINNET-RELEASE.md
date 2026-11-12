# Mainnet inspector release — 11 November 2026

Mainnet read-only inspection uses https://indexer-a.ootle.tari.com, verified against the Veil explorer's published network configuration. A third-party mainnet template publication is included as a reproducible example. It is not a Specter contract deployment.

Archived October Esmeralda captures remain explicitly labeled pre-reset. Their explorer links may no longer resolve. Mainnet and archived findings carry network provenance in exported reports.

The optional self-payment experiment remains restricted to Esmeralda by the existing client guard. No mainnet signing or transfers are introduced. Wallet lookup requires a positively reported mainnet network; unknown networks fail closed.

Analysis covers selected V1 instruction fields. Unsupported instructions, including template publication internals, are reported as inspection limits. No signature, consensus, anonymity or ownership guarantee is made.

Bonus status: this frontend release does not publish a Specter contract and does not establish first-20 bonus qualification. A useful report-commitment contract, its engine tests and publication would be separate unfinished work. Do not use the example third-party transaction as proof of Specter deployment.
