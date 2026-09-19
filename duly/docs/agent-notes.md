# Duly — current state

Updated September 20, 2026. The active product is **V3 building governance**, published on `main`; current UX source `b519217`, V3 base `f3a5498`, with the friend’s `6bad646` pitch update merged before the dues work. Run Git status/log for the current revision and push status. Previous V2 notes are preserved in `archive/agent-notes-v2.md`; do not treat their old scope as current.

## Demo, passkey and error follow-up — September 20, 2026

Published source `b519217` to `main` and Vercel deployment
`dpl_DMhRECzPfQoZQ2MvgBXcaX5eNTox` to **https://duly-sepia.vercel.app**.
Canonical HTML and all 17 JS/CSS assets match the tested local build; candidate
API and public HTTPS account-screen checks passed. Upload allowlist: 63 files.

- All current testnet manager/setup/expense screens default to the clearly labelled
  sample IBAN when no preference exists. Existing saved recipients stay intact;
  **Use the demo IBAN** explicitly replaces one for new expenses. Signed intents
  keep the original destination and ceiling.
- New expense preflight reads the treasury again and reserves pending ceilings.
  Insufficient funds show **Kasada yeterli bakiye yok.** / **There is not enough
  money in the treasury.** The solo expense dialog can run a 500 simulated TRY
  deposit plus apartment 1 contribution, reusing any pending contribution.
- The bank keeper pauses unfunded expenses before creating an order or executing
  a prepared one. Prepared quotes use their actual USDC amount. Expired quotes
  remain paused for review; no replacement order is silently created.
- Display errors are mapped to TR/EN explanations; detailed diagnostics are only
  available in the collapsed technical section. Progress and success store
  translation keys, so a language change also updates existing notifications.
  Pending bank responses are never labelled completed.
- Passkey creation selects a platform authenticator with a required discoverable
  credential. Authentication hints prefer the client device; an explicit alternate
  action allows phone/security-key discovery. User verification remains required.
  The SDK still verifies account provenance and ownership. No secrets are moved
  between devices. Windows Hello availability is detected and the passkey-free
  demo remains directly accessible. Physical Windows hardware is untested.
- 37 web tests passed, including the exact reported 500 TRY / 8.1584362 USDC
  balance case, original-quote preservation, expiry boundaries, translation
  changes and passkey verification options. TypeScript/Vite build passed.
- Manual browser checks verified blank-device fallback, fresh demo creation,
  prefilled IBAN, blocking an unaffordable amount, TR → EN success-message change,
  and mobile layout. A fresh demo deposit is retained while the external anchor
  reports `pending_anchor`; it is not evidence of a completed transfer.
  The final UI was verified to show a saved/pending notice for that same order,
  not an error or a completed payment. Test state stays in the browser at
  localhost:5175; never clear it.
- A funded solo demo completed a new 100 TRY expense to the sample IBAN with
  the 2.27 USDC automatic cap: **FAST-NVXJ9O5Y48**, contract status **Settled**.
  Recipient and bank-reference hashes were verified against the chain. Evidence:
  `deployments/building-demo-ux-testnet-v3.json`.
- The user's existing 500 TRY order now has an expired bank quote. A real API
  check returned HTTP 200 / `needs-review` / `QUOTE_EXPIRED`, with no new order
  or transfer. Historical error #21 was insufficient treasury funds, not IBAN
  validation. That old order was not cancelled, replaced or paid during this work.

## UX revision — September 20, 2026

The current request is to clarify building access, use QR codes, route new
expenses to a saved manager IBAN, calculate the USDC ceiling automatically, and
fix the name/passkey sequence. The follow-up request explicitly authorizes
committing and pushing these changes to `main` and publishing them on Vercel.
Published source `c285dec` to `main` and Vercel deployment
`dpl_HJ391WDReMfHucWLBTF2bs2R6Na6` to **https://duly-sepia.vercel.app**.
The supplied older Aidat handoff is background, not the active V3
specification or the source of this publishing authorization.

- `BuildingAccess.tsx`: separate **Create a new building** and **Join an existing
  building** actions. Joining is available without an account from the overview,
  building page and building selector. Share a QR plus link; scan using the
  camera, an on-device image decoder or paste a link. Validate the contract and
  show its name/seat count before switching. A QR grants viewing only. Arbitrary
  scanned URLs are never navigated to. The scanner is lazy-loaded with a worker
  fallback; camera tracks are released when closing or leaving the scanner.
- New expenses require only description and TRY amount. A manager IBAN is
  validated and saved once at setup or first expense, and can be edited in the
  manager account or expense preview. Storage is scoped to building + manager
  **in this browser** (`v3:manager-iban:<building>:<manager>`); this is not a
  cross-device bank profile. A replacement manager does not inherit the previous
  manager's preference. Existing signed expenses keep their original recipient.
- `expense-form.ts`: current anchor sell rate + 10% headroom, rounded upward to
  a USDC cent with integer arithmetic. No editable expense ceiling. Missing or
  stale rates block a new submission; saved intents retain their amount, IBAN
  and ceiling on retry. The bank still validates its exact quote against the
  signed maximum, and unused headroom stays in the treasury.
- `AccountAccess.tsx`: required display name first, a separate confirmation
  step before invoking WebAuthn, a dedicated returning-user sign-in choice,
  preserved names on validation errors and pending deployment retries, and
  visible saved profile names. The account adapter also rejects empty names
  before touching browser credentials. Silent session restoration remains
  non-interactive. Dialogs focus the name field and restore their trigger.
- Updated the existing live/passkey regression selectors to match these flows.
  No Rust/WASM, governance, bank destination validation or production hosting
  configuration changed. The existing local server still serves built output
  and APIs at **http://localhost:5174**.

Verification for this revision: TypeScript/Vite build and **31 web tests** pass.
Interactive browser checks cover blank/whitespace names, normalization and back
navigation, distinct returning-user sign-in, keyboard focus trapping/restoration,
valid QR image → verified building → navigation, invalid QR/link rejection,
pasted-link preview, QR sharing/copy, invalid IBAN rejection, edited manager IBAN
surviving reload, and recalculation from 100 to 1,000 TRY. Reviewed mobile 360/390
and desktop layouts, both languages and themes; no horizontal overflow in the
tested name dialog. These are developer-run UX checks, not participant research
or full accessibility certification. Physical camera permissions and physical
biometric signing were not exercised; QR image decoding and pre-WebAuthn steps
were tested. Private browser demo state remains in the in-app browser; do not
clear it. Local QR fixtures live in ignored `web/test-results/ux-access/`.

Fresh UI-to-bank test passed: a new solo building
`CA3KJUSOEGEUFAUNEGERB7V5SB7EYQAFUFENKYAKVCEKTLGGGDZCV3U6` received 5 test USDC.
An edited manager IBAN survived reload and was used for a 100 TRY expense with
an automatic 2.27 USDC ceiling. Actual disbursement was 2.0601516 USDC; the bank
returned **FAST-WE424K7OML** and the contract reached **Settled**. Verified the
recipient hash against the selected manager account, bank reference hash against
the contract receipt, and successful disbursement transaction
`c71dd293f5ab4820a357f7834e34fad454d3c5769ed16c79de27bedfc77e9697`.
Public evidence: `deployments/building-ux-testnet-v3.json`. No real money moved.

Publication checks passed: actual Vercel build, candidate bank config and dues
ledger, canonical HTML and all 17 JavaScript/CSS assets matching the local build,
private/source paths returning 404, and unauthenticated keeper returning 401.
The public HTTPS browser passed the name-first/passkey review and QR-image →
verified building → navigation checks without console warnings/errors. See
`deployment.md` for the candidate URL and release record. No server keys changed.

## User decisions

- Brand Duly; repository keeps the historical `mryavascann/aidat` URL and is public.
- Remove service-provider role. Recipients receive a manager-created TRY expense at an IBAN and need no app or wallet.
- Fixed apartment seats; direct signed sale transfer; owner-delegated voting; anyone can pay a seat's dues. Each apartment counts once.
- Recovery: manager plus deed hash, other apartments' majority, then seven days for old-owner veto. Apartment majority replaces managers and approves budgets/recipients.
- **New recipient or over-budget expense: three days without objection**, with majority available earlier. Any objection requires majority. Routine approved-recipient spending inside the TRY and USDC budget has no additional wait.
- **30-day periods from setup** for both budgets and monthly dues, not calendar months. Changing limits never resets spent amounts.
- Passkey smart accounts and a one-person jury demo. Demo votes/accounts must be labelled as simulated; do not weaken normal contract timers.
- Latest request: improve building QR access, manager IBAN, automatic expense caps and name/passkey UX, then push **main** and publish on Vercel. This follows the completed friend’s contribution merge and dues work. Existing authorization covers commit, push and Vercel publication. The user did not authorize mainnet payments or contacting external people.

## Implementation

- `contracts/duly-building` (Soroban SDK 27.0.6): native authorization; fixed, persistent seats; versioned votes; transfer/delegation; manager election; recovery; budget/recipient motions; expenses; vault custody; bank attestations; separate Disbursed/Settled states. `execute_expense` is permissionless after all guards pass.
- `contracts/duly-factory`: immutable bytecode/bank/token/reserve. Salt binds the authenticated manager. Supports classic or smart-account managers.
- `web/src/BuildingApp.tsx`, `building.css`, `i18n/building.ts`, `lib/building.ts`: TR/EN and both themes; overview, expenses, dues, apartments/decisions. Active UI has no provider, invitation inflation or role switch. Existing V2 `App.tsx` is preserved but not loaded.
- `web/accounts`: Smart Account Kit 0.8.0 with SDK 16.3.0; SDK 17.1.0 is aliased as `@duly/stellar-sdk` for the rest of the web/server app. Only serialized XDR strings cross the boundary. Account creation is saved before submission and verifies its on-chain birth, code and passkey ownership.
- `api/` reexports `web/server/`: bank, relay, dues accounting and settlement keeper. Server secret is `DULY_BANK_SECRET`; cron bearer is `CRON_SECRET`. The client receives no bank key.
- Bank routes use the actual sandbox SEP-12 IBAN, exact TRY SEP-38 quote and SEP-6 order. Each expense gets a distinct classic escrow so the workshop's payment watcher receives its exact memo. A C-address smart account can receive bank-funded test USDC and authorize its contribution.
- Automatic expense queue is encrypted with AES-GCM in separate classic account-data journals. Account sequence implements compare-and-set. A registry on the bank account lets the keeper discover queued work after browser closure. Public results omit raw IBANs and sealed-flow secrets. New withdrawals can only originate through this queue; saved legacy V3 flows remain resumable.
- UI advances eligible queues every five seconds while visible. Vercel Hobby runs `/api/settle` daily at 09:00 UTC. This is a fallback with scheduling imprecision, not exact-deadline execution. Expired or uncertain bank orders require reconciliation and do not silently create another transfer.
- Normal clocks: 3 days, 7 days, 30 days. Demo WASM: 20 seconds, 60 seconds, 10 minutes. Both timestamp and ledger guards apply.

## Dues update

- Merged `origin/codex/treasury-foundation` at `6bad646` (pitch/business model) into the V3 implementation. Preserved the friend's proposed adoption/pricing sections; corrected technical claims and distinguished the now-built basic dues tracker from proposed Pro features.
- Direct USDC is the default contribution method beside TRY. Solo demo funding is one-time, journaled and only credits the demo wallet; the user then chooses an apartment and contributes.
- `web/src/lib/dues.ts` and `features/dues/DuesOverview.tsx`: setup-relative billing, oldest-first allocation, partial/paid/unpaid status, advance credit, current total arrears, period selection and unpaid filtering. Debt stays with the apartment. A prior period shows current settlement, not an as-of historical statement.
- `web/server/dues.mjs`: frozen TRY accounting from exact successful treasury events. Direct USDC uses a sealed pre-payment rate; bank deposits use their actual gross TRY amount. Atomic receipt/reference claims in a derived Stellar classic account prevent double credit and share records across browsers. This is trusted adapter reporting, not a contract upgrade or a trustless FX oracle.
- Missing historical credit is never guessed: an on-chain/index mismatch displays Review needed. Saved TRY flows can be reconciled while RPC receipts remain available. Once indexed, records survive RPC retention. Pending signed contributions retain the exact quote/intent; an unsigned expired quote can refresh safely.
- Local live dues verification: 5 USDC and 1 USDC direct contributions, 50 TRY bank contribution, receipt replay without double credit, cross-browser visibility and mobile light/dark accessibility passed. A separate normal passkey building recorded exactly 50 TRY from a WebAuthn-authorized payment. Public evidence: `deployments/building-dues-testnet-v3.json`; read-only check: `node scripts/verify-dues.mjs`.
- No Rust/WASM changes or V2/V3 fund migration. Details and public verification are in `stories/03-monthly-dues.md`.

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
- 16 script and 24 web model/server tests passed. The Vite/TypeScript and actual Vercel builds passed.
- 32 TR/EN, light/dark, desktop/mobile page scenarios passed automated accessibility checks; screenshots reviewed. This is not complete manual accessibility certification.
- Final-WASM live solo journey: 200 TRY → 4.0792181 USDC → 100 TRY expense → automatic settlement after accelerated objection period, receipt FAST-MVXYNQXSA9.
- Virtual CTAP2 WebAuthn with real testnet smart account: create normal building, pay dues, create proposal and change vote yes/no/yes; one apartment still counts once. Physical biometrics were not tested.
- Direct keeper settlement with no browser, replay without extra payment, encrypted storage, public IBAN privacy and stale-write rejection passed.
- Protected Vercel candidate bank config matched the on-chain bank. Authorized `/api/settle` returned an empty queue successfully. The final V3 deployment was promoted to https://duly-sepia.vercel.app. Its JS/CSS hashes match the local build, private/source probes return 404, and unauthenticated cron returns 401. The public HTTPS site passed 32 page checks, 16 dialog accessibility/focus checks, and the real-testnet virtual-passkey account/building/dues/voting journey. See `deployment.md`.
- Legacy-only test scripts are named `test:legacy:*`; active V3 checks are `test:browser`, `test:live`, `test:passkey`, `test:queue`, `test:dues`. Do not mistake legacy selectors for V3 coverage.


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

Production dues verification passed on **https://duly-sepia.vercel.app**: a fresh solo building loaded one-time test funds without paying dues, contributed 5 and 1 USDC for two apartments, and paid 50 simulated TRY for a third. All three credits survived reload and were visible from another browser; receipt replay created no extra credit. Paid/partial filtering, mobile light/dark accessibility and the separate 32 TR/EN/theme/viewport/page suite passed. Public proof: `deployments/building-dues-testnet-v3.json` (seven local/production receipts, including a normal passkey building). Deployment: `dpl_HU1WEbg9b7yWWmqqqVZob4jid2u5`.
