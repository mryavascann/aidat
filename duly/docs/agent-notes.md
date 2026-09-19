# Duly — current state

Updated September 19, 2026. The active product is **V3 building governance**, implemented on `codex/building-governance` from `7dd03af`. Run Git status/log for the current revision and push status. Previous V2 notes are preserved in `archive/agent-notes-v2.md`; do not treat their old scope as current.

## User decisions

- Brand Duly; repository keeps the historical `mryavascann/aidat` URL and is public.
- Remove service-provider role. Recipients receive a manager-created TRY expense at an IBAN and need no app or wallet.
- Fixed apartment seats; direct signed sale transfer; owner-delegated voting; anyone can pay a seat's dues. Each apartment counts once.
- Recovery: manager plus deed hash, other apartments' majority, then seven days for old-owner veto. Apartment majority replaces managers and approves budgets/recipients.
- **New recipient or over-budget expense: three days without objection**, with majority available earlier. Any objection requires majority. Routine approved-recipient spending inside the TRY and USDC budget has no additional wait.
- **30-day periods from setup**, not calendar months. Changing limits never resets spent amounts.
- Passkey smart accounts and a one-person jury demo. Demo votes/accounts must be labelled as simulated; do not weaken normal contract timers.
- Existing authorization covers commit, push and Vercel publication. The user did not authorize mainnet payments or contacting external people.

## Implementation

- `contracts/duly-building` (Soroban SDK 27.0.6): native authorization; fixed, persistent seats; versioned votes; transfer/delegation; manager election; recovery; budget/recipient motions; expenses; vault custody; bank attestations; separate Disbursed/Settled states. `execute_expense` is permissionless after all guards pass.
- `contracts/duly-factory`: immutable bytecode/bank/token/reserve. Salt binds the authenticated manager. Supports classic or smart-account managers.
- `web/src/BuildingApp.tsx`, `building.css`, `i18n/building.ts`, `lib/building.ts`: TR/EN and both themes; overview, expenses, dues, apartments/decisions. Active UI has no provider, invitation inflation or role switch. Existing V2 `App.tsx` is preserved but not loaded.
- `web/accounts`: Smart Account Kit 0.8.0 with SDK 16.3.0; SDK 17.1.0 is aliased as `@duly/stellar-sdk` for the rest of the web/server app. Only serialized XDR strings cross the boundary. Account creation is saved before submission and verifies its on-chain birth, code and passkey ownership.
- `api/` reexports `web/server/`: bank, relay and settlement keeper. Server secret is `DULY_BANK_SECRET`; cron bearer is `CRON_SECRET`. The client receives no bank key.
- Bank routes use the actual sandbox SEP-12 IBAN, exact TRY SEP-38 quote and SEP-6 order. Each expense gets a distinct classic escrow so the workshop's payment watcher receives its exact memo. A C-address smart account can receive bank-funded test USDC and authorize its contribution.
- Automatic expense queue is encrypted with AES-GCM in separate classic account-data journals. Account sequence implements compare-and-set. A registry on the bank account lets the keeper discover queued work after browser closure. Public results omit raw IBANs and sealed-flow secrets. New withdrawals can only originate through this queue; saved legacy V3 flows remain resumable.
- UI advances eligible queues every five seconds while visible. Vercel Hobby runs `/api/settle` daily at 09:00 UTC. This is a fallback with scheduling imprecision, not exact-deadline execution. Expired or uncertain bank orders require reconciliation and do not silently create another transfer.
- Normal clocks: 3 days, 7 days, 30 days. Demo WASM: 20 seconds, 60 seconds, 10 minutes. Both timestamp and ledger guards apply.

## Public deployment and evidence

- Normal treasury: `CBIGWOYBTFHV32OZWTZSYKP2TLDPHJIDJJSG5XAGG22K6VRSSP2MLIMM`.
- Factory: `CBODQGDCBJ2HXLSKMLJ33STVNF37QRIK7L2PVATMUSMWREMMSKUA2NA2`.
- Bank public address: `GBV3EGX4UHTA2TNWYTXM3RWNPUJ2BWRRHFPIDSSHG6TGCRRULAJT5OSX`.
- Building WASM: `479daf3bd8ede6ce55e58587cd676278f684f486cd7b1e56b71bd61da5d2944d`.
- Demo WASM: `d4175ad58d126a402d3278025e019bee40b25265a1308837085556b0da094cc3`.
- Factory WASM: `12ec81d316ec436d9e63e187ec37a58d03b67809e03c125f811d850e816806ea`.
- Same Circle token and compatible liquid DeFindex reserve as V2; public constants in `deployments/building-testnet-v3.json` and `web/src/building-deployment.json`.
- Public browser/queue/passkey proof: `deployments/building-browser-testnet-v3.json`. `node scripts/verify-building.mjs` is read-only and verifies nine successful receipts, artifact/contract hashes, factory settings, clocks, passkey seat tally, bank disbursement and vault backing.
- Initial unpublished V3 contract proofs/WASM are preserved in `deployments/archive/*v3-initial*`; manifests accept only the exact previous hashes/factory plus the same bank/token/reserve. These keep earlier test funds and journals usable. Do not remove that compatibility casually.
- V2 treasury `CC7TIRVPWB4EFE7ZPA3JZZD2VC5ZDRAHFN6UURSGW4JNJISMKGMGTKUR`, its 4.1584362 USDC backing and previous test evidence were not migrated or drained. V2 reconciliation can use the preserved branch/source; active V3 never consumes V2 records.

## Verification

- 47 workspace Rust tests + 16 demo-feature building tests passed; format and Clippy with warnings denied passed.
- 16 script and 14 web model/server tests passed. The Vite/TypeScript and actual Vercel builds passed.
- 32 TR/EN, light/dark, desktop/mobile page scenarios passed automated accessibility checks; screenshots reviewed. This is not complete manual accessibility certification.
- Final-WASM live solo journey: 200 TRY → 4.0792181 USDC → 100 TRY expense → automatic settlement after accelerated objection period, receipt FAST-MVXYNQXSA9.
- Virtual CTAP2 WebAuthn with real testnet smart account: create normal building, pay dues, create proposal and change vote yes/no/yes; one apartment still counts once. Physical biometrics were not tested.
- Direct keeper settlement with no browser, replay without extra payment, encrypted storage, public IBAN privacy and stale-write rejection passed.
- Protected Vercel candidate bank config matched the on-chain bank. Authorized `/api/settle` returned an empty queue successfully. The final V3 deployment was promoted to https://duly-sepia.vercel.app. Its JS/CSS hashes match the local build, private/source probes return 404, and unauthenticated cron returns 401. The public HTTPS site passed 32 page checks, 16 dialog accessibility/focus checks, and the real-testnet virtual-passkey account/building/dues/voting journey. See `deployment.md`.
- Legacy-only test scripts are named `test:legacy:*`; active V3 checks are `test:browser`, `test:live`, `test:passkey`, `test:queue`. Do not mistake legacy selectors for V3 coverage.


Final production verification: the public HTTPS solo flow completed 200 simulated TRY → 4.0792181 test USDC → 100 TRY IBAN payment (**FAST-J83IBKWCYF**). A separate 50 TRY payment completed with the browser closed through one authenticated Vercel keeper call (**FAST-ECU8EIOYRL**); retry left the treasury balance unchanged. The public-domain passkey account/building/dues/proposal/vote-change test passed against the final WASM. Allowlisted evidence: `deployments/building-production-testnet-v3.json`. Run `node scripts/verify-building.mjs building-production-testnet-v3.json` to verify it independently.

## Recovery and gotchas

- Never delete `.duly-state.json`, `.duly-*-key` or `web/test-results/`. They contain retained transaction journals, browser demo secrets and virtual-authenticator credentials. These are ignored and not deployed.
- New bank/owner keys: `.duly-bank-v3-key`, `.duly-owner-v3-{1,2,3}-key`; cron secret `.duly-cron-v3-key`. Do not print them. Hosted values are server-only Vercel Production secrets.
- Current local server is `node server/local.mjs`, port 5174. It serves build output and APIs only. Use **localhost**, not an IP, for WebAuthn. A deployed domain and localhost have independent passkeys/storage. Restart the local server after server/manifest edits.
- Smart Account Kit requires SDK 16.3 despite the app using 17.1. Do not dedupe/upgrade it to 17. Never pass SDK class instances between installations, including two separate 17.x Asset constructors; reconstruct from strings/XDR.
- OpenZeppelin `account.execute` returns void. Obtain inner building/proposal IDs from successful receipt contract events, filtered by emitting contract and event type. Never infer a concurrent counter.
- Signed auth/function tuples get isolated deterministic fee channels. Reconcile the exact function on that channel before retrying; memo is unsupported in Soroban transactions. Do not fund SAK's shared sign-only deployment source.
- Cross-contract vault authorization is consumed by the next invocation. Read share balances first, register exact nested token authorization, then call the vault. Redemption rounds shares upward and checks actual proceeds.
- A native dialog makes unrelated overlays inert; close it before opening Wallets Kit. App dialogs preserve keyboard focus.
- `scripts/deploy-building.mjs` journals before submitting and refuses changed WASM under a completed release. Explicitly version future deployments and retain old references.
- Vercel is CLI-deployed, not Git-autodeployed. Source upload is an explicit allowlist; private keys, raw artwork, ZIPs, journals and test fixtures are excluded.

## Remaining limits, not hidden feature work

Testnet funds and simulated bank transfers only. Initial owner identity, legal title and IBAN beneficial ownership are off-chain trust assumptions. Silent approval of budget exceptions means no absolute budget loss cap. The bank/fee service is trusted; expired-bank-order refunds, production rate limits/funding/monitoring, regulated banking and independent security review remain outside the MVP. No active vault yield is claimed. Wallet synchronization/recovery and physical biometric/external-wallet signing still need hands-on validation. Low/moderate advisories remain in optional wallet dependencies; no high/critical advisory was found in this lockfile.

Actual team details, real attendee validation and an official deck/submission are separate work; do not invent traction or contact organizers without authorization. Root README is the jury-facing product guide.
