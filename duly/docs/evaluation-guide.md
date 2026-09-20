# Duly evaluation guide

Technical evaluation detail behind the [project README](../../README.md). Public artifacts contain addresses and receipts, never private signing material.

## Deployed contracts

Network: **Stellar Testnet**. The [deployment manifest](../deployments/building-testnet-v3.json) records WASM hashes, configuration and deployment transactions.

| Component | Contract ID |
| --- | --- |
| Normal building treasury | `CBIGWOYBTFHV32OZWTZSYKP2TLDPHJIDJJSG5XAGG22K6VRSSP2MLIMM` |
| Immutable building factory | `CBODQGDCBJ2HXLSKMLJ33STVNF37QRIK7L2PVATMUSMWREMMSKUA2NA2` |
| Circle testnet USDC token | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Compatible DeFindex liquid reserve | `CBYR7JQC7XBG4TJIRVLZDTJZQE6UBGUZ7C5I4J64NPVNZ64YKBTLNUTG` |
| WebAuthn verifier | `CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F` |

The [latest demo receipt](../deployments/building-demo-ux-testnet-v3.json) belongs to a separate demo treasury, `CA3KJUSOEGEUFAUNEGERB7V5SB7EYQAFUFENKYAKVCEKTLGGGDZCV3U6`. It records 100 simulated TRY settled for 2.0601077 test USDC. A separate deposit remained pending at the external anchor; this does not establish that every fresh deposit completes immediately.

## Design decisions

- **Fixed apartment seats.** The manager cannot create extra voters after initialization. A seat transfer clears delegation and invalidates stale votes. Anyone may pay for a seat without acquiring a vote.
- **Explicit spending policy.** Routine payments need an approved recipient and available TRY and USDC budget. New recipients and exceptions use notice, objection and majority rules. Residents must monitor notices. The policy permits an unopposed exception and is not an absolute loss cap.
- **Immutable payment terms.** The original recipient, TRY amount and USDC limit stay attached to a signed expense. The form estimates the limit using the current bank rate plus 10% headroom. An unavailable or stale rate blocks a new submission.
- **Liquidity before payout.** The treasury counts its USDC and redeemable vault shares. The UI reserves pending expense ceilings. An unfunded queue item pauses before a new bank order or contract execution.
- **Classic escrow at the bank boundary.** The anchor watches a classic Stellar account and exact memo. The server bridges the Soroban payout into that format. The adapter is a trusted intermediary.
- **Recoverable execution.** Signed envelopes are saved before submission. The automatic expense journal uses AES-GCM encrypted testnet account-data records and sequence-based concurrent-write rejection. Pending and failed bank orders remain available for reconciliation, rather than being blindly replaced.
- **Shared dues accounting.** A server adapter verifies contribution receipts and records TRY credit in per-building account-data records. An atomic claim prevents duplicate credit. Payments clear oldest debt first, surplus carries forward, and debt follows the apartment on transfer. Periods are 30 days from initialization, not calendar months. The adapter is trusted for TRY valuation and accounting.

Registered expenses advance while the app is open, with a daily Vercel keeper as fallback. This deployment does not guarantee execution at the exact deadline. Expired bank quotes pause for review.

## Pending bank dues

**Cancel dues** stops an unsigned contribution workflow in this browser and
unlocks the payment form. The original bank reference, sealed route and receipts
stay in payment history. A late bank response preserves the stop request; it
cannot trigger a treasury contribution. **Check bank status** only reads the
original order. **Resume these dues** explicitly continues that same record.

This does not reverse a bank transfer. The workshop anchor has no supported
cancellation endpoint in its [API guide](https://tr-mock-anchor.fly.dev/guide).
Once treasury signing has started, Duly keeps the contribution available for
reconciliation instead of claiming it was cancelled. Bank waits return control
to the user rather than holding the form in a long polling loop. Stop state is
browser-local; it is not a cross-device bank instruction.

## Account and demo boundaries

Smart Account Kit 0.8.0 uses Stellar SDK 16.3.0 with pinned OpenZeppelin account WASM and a WebAuthn verifier. Chain and bank workflows use SDK 17.1.0 through a serialized boundary. Passkey tests use a virtual CTAP2 authenticator with real WebAuthn and real testnet signatures. They are not physical Windows Hello or biometric-device tests.

The solo demo holds disposable test keys in browser storage and simulates three apartment seats. QR viewing grants no ownership or voting rights. The manager's saved IBAN preference is scoped to this browser, building and manager; other devices start with the labelled sample unless configured. Changing it affects new expenses only.

Normal contracts use 3-day objections, 7-day recovery and 30-day periods. Demo WASM uses 20 seconds, 60 seconds and 10 minutes. Both elapsed-time and ledger boundaries must pass. No manager can shorten a deployed building's timers.

## Verification commands

Run from `duly/` after the README setup:

```sh
cargo test --workspace
cargo test -p duly-building --features demo
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
npm test
npm --prefix web test
npm --prefix web run build
node scripts/verify-building.mjs building-production-testnet-v3.json
node scripts/verify-dues.mjs
npm --prefix web run test:browser
# Controlled bank fixtures; no funds move in this regression test.
DULY_URL=http://localhost:5174 npm --prefix web run test:bank-cancel
```

These integration tests use actual testnet transactions and keep private recovery state locally:

```sh
npm --prefix web run test:live
npm --prefix web run test:dues
DULY_URL=http://localhost:5174 npm --prefix web run test:passkey
npm --prefix web run test:queue
```

Do not delete `.duly-*-key`, `.duly-state.json`, browser keys or saved payment intents while testing. They are ignored by Git and excluded from deployment. Use localhost or HTTPS for passkeys.

## Stellar references

Development records document adapting `skills/methodology/create-ux-design` from [stellar-build at commit 40396f0](https://github.com/kaankacar/stellar-build/tree/40396f0946461b955091b15f0af9714d3a3ac8ae/skills/methodology/create-ux-design). See the [UX specification](planning/ux-design-specification.md) and [architecture provenance](planning/architecture.md). The upstream installer and hooks were not run.

These handbook-listed skill files were reviewed while preparing this submission documentation. This is a documentation cross-check, not a claim that they originally generated the implementation:

- [`stellar-anchor-skill/SKILL.md`](https://github.com/CheesecakeLabs/stellar-anchor-skill/blob/main/SKILL.md): discovery, authentication, quote expiry, exact payment memos and transfer states. Duly uses SEP-1, SEP-10, SEP-12, SEP-38 and SEP-6.
- [`defindex-sdk/defindex-sdk-skill.md`](https://github.com/paltalabs/defindex-sdk/blob/main/defindex-sdk-skill.md): vault deposit/withdrawal and signed transaction boundaries. Duly calls its compatible vault from Soroban; it does not claim to use `@defindex/sdk`.

## Source map

- [Building contract](../contracts/duly-building/src/lib.rs), [tests](../contracts/duly-building/src/test.rs), [factory](../contracts/duly-factory/src/lib.rs)
- [Frontend](../web/src/BuildingApp.tsx), [chain workflows](../web/src/lib/building.ts), [passkey boundary](../web/accounts/index.mjs)
- [Bank adapter](../web/server/bank.mjs), [journal](../web/server/journal.mjs), [keeper](../web/server/settle.mjs), [fee sponsor](../web/server/relay.mjs)
- [Dues adapter](../web/server/dues.mjs), [calculation](../web/src/lib/dues.ts), [manager view](../web/src/features/dues/DuesOverview.tsx)

Real-money use needs a regulated bank/anchor partner, owner identity checks, refund and reconciliation procedures, fee funding, wallet recovery and independent security review. An [informal nine-person survey](user-research.md) provides early problem feedback. Active use, paid adoption, guaranteed yield and mainnet readiness are not claimed.
