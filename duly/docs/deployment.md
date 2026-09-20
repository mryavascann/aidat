# Duly on Vercel

Production testnet demo: **https://duly-sepia.vercel.app**. Implementation branch: [`main`](https://github.com/mryavascann/aidat/tree/main).

Vercel project `duly`, scope `sametgoc81tr-4111s-projects`. Current outgoing-cancellation and majority build: [`dpl_5kh8xSSUrSsEDR1cPBcRVF2AuNEe`](https://vercel.com/sametgoc81tr-4111s-projects/duly/5kh8xSSUrSsEDR1cPBcRVF2AuNEe), September 20, 2026, from source commit [`2574710`](https://github.com/mryavascann/aidat/commit/2574710). Candidate URL: `https://duly-nexpo177d-sametgoc81tr-4111s-projects.vercel.app`. It replaces `dpl_7uMfcBCD1YU2dpexx1y71AuJ2Qww` without changing contract addresses or server keys. Previous V2 publication details remain in `archive/deployment-v2.md`.

This deployment uses Stellar testnet and the simulated workshop bank. Publishing does not make these real funds or real bank transfers. Passkeys and browser storage are origin-bound: localhost, a candidate domain and the production domain have separate credentials and saved sessions.

## Build and publish

Run from the repository root. `vercel.json` sets:

- Install: `npm ci --prefix duly && npm ci --prefix duly/web`.
- Build: `npm --prefix duly run web:build`.
- Static output: `duly/web/dist`.
- Node server functions: `api/bank.mjs`, `api/relay.mjs`, `api/settle.mjs`, `api/dues.mjs`, each with a 120-second maximum.
- Explicit public manifest inclusion for server tracing; runtime code imports the manifest directly.
- Once-daily keeper: `/api/settle`, 09:00 UTC (`0 9 * * *`).

The source upload allowlist includes 67 files: app, server adapters, passkey package, public manifest, shared browser-safe modules, the product-tour MP4 and build configuration. It excludes CLI keys, private state, test fixtures, Rust sources/WASM, design ZIP, raw artwork and local server. Only compiled frontend files and intended public assets are served as static resources; source and private-path probes must return 404.

V3 requires two **server-only Production secrets** in Vercel:

- `DULY_BANK_SECRET`: the retained key whose public address equals the manifest's immutable bank address. Also derives distinct escrow, fee-channel and encryption keys.
- `CRON_SECRET`: independent random bearer secret for the settlement endpoint.

These were configured through stdin as Vercel Secret variables. Never put them in frontend-prefixed environment variables, deployment JSON, Git or terminal output. Replacing the bank secret would break ownership and access to existing encrypted journals; retain it securely. Each deployment's bank identity is fixed in its contracts.

```sh
npm --prefix duly run web:build
npx --yes vercel@59.23.2 link --yes --project duly --scope sametgoc81tr-4111s-projects
npx --yes vercel@59.23.2 deploy --dry --json
npx --yes vercel@59.23.2 deploy --prod --skip-domain --yes
# Check the returned candidate using the account's authenticated Vercel CLI.
npx --yes vercel@59.23.2 curl /api/bank --deployment <candidate-url> -- --request POST --header 'Content-Type: application/json' --data '{"action":"config"}'
npx --yes vercel@59.23.2 promote <candidate-url> --yes
```

The CLI uses the existing Vercel login. Protected candidate URLs require authorized deployment access; `vercel curl` supports that. Do not mistake a login redirect's HTTP 200 for an app/API success. Production's canonical domain is public. GitHub automatic deployment is not configured; pushing Git alone does not update the website.

## Payment execution and recovery

The three-day rule makes an expense eligible; it does not schedule a guaranteed exact-second bank payment. A visible app checks eligible queues frequently. With the browser closed, the once-daily Vercel job advances them. Hobby scheduling can run later within its window. The keeper has a finite execution budget; a large backlog needs more frequent hosting and operations capacity before production.

The queue stores encrypted instructions and the exact bank flow in separate Stellar classic account-data journals, with sequence-based concurrent-write rejection. Its registry survives browser closure and server restarts. A completed record is retained for reconciliation while its active registry entry is removed. A retry uses the same signed envelope/reference; expired and uncertain bank orders are not silently replaced. Refund/requote procedures are not implemented.

`/api/settle` rejects missing/wrong bearer credentials. `/api/bank` public keeper output reveals only public expense status, amount and receipt; it exposes no raw IBAN or decryptable saved bank flow. Receipt status distinguishes USDC disbursement from final simulated bank settlement.

## Verification

### Current outgoing cancellation and majority release — September 20, 2026

Source `2574710` keeps cancellation and close controls available while the
outgoing bank-payment dialog is busy. Pending expenses can be cancelled by
their manager; an already-disbursed transfer retains its reference and only
the waiting screen stops. The current request still saves its receipt and
holds the payment lock until it resolves. Late responses cannot revive a
chain-confirmed cancellation. Cancelled saved withdrawals exit before anchor
work. No transfer reversal or refund is implemented.

The existing contracts already require strict majority for voting. The UI
now displays the required approval count and marks majority as reached; the
solo simulator stops at that threshold. Three apartments need two approvals.
Contract tests also prove two approvals beat one opposing vote.

55 web tests, 19 normal and 19 demo contract tests, formatting and build passed.
The 32-page browser suite passed locally and on the canonical HTTPS domain.
Eight incoming-cancellation and eight outgoing-dialog accessibility scenarios
passed locally. A real isolated testnet proposal reached two approvals without
the third vote, then was cancelled while a controlled bank response was held.
The treasury kept its 5 USDC and the cancellation survived the late response
and reload. Two Disbursed fixtures verified stop/close without sending a
cancellation transaction. Public evidence:
`deployments/building-cancellation-testnet-v3.json`.

The Vercel build passed and the protected candidate retained the expected
testnet bank identity. After promotion, canonical HTML, all 17 JS/CSS files
and the video matched the local build. Private/source probes returned 404;
unauthenticated settlement returned 401. The canonical bank API returned
`cancelled` for all three saved-withdrawal actions against the cancelled
test expense. No bank order or transfer was created by these cancellation
checks. The 67-file upload excludes private fixture state.

### Previous account balance and demo funding release — September 20, 2026

Source `8658c34` shows the active account's USDC balance and the three demo
wallet balances in My account. New demos prepare each wallet with 20 test USDC
using bounded testnet XLM path payments; existing demos can prepare their saved
wallets. No bank order or dues contribution is created during preparation.

51 web tests, formatting and the TypeScript/Vite build passed. A fresh local
demo verified 20/20/20 USDC, funding replay and an empty treasury, then a
5-USDC contribution and 15/20/20 balances. Reload and eight account-dialog
TR/EN, theme and viewport accessibility checks passed, alongside the existing
32-page browser suite. Public evidence is in
`deployments/building-demo-wallets-testnet-v3.json`.

The Vercel build completed and the protected candidate retained the expected
bank identity. After promotion, canonical HTML, all 17 JS/CSS files and the
video matched the local build. Private/source probes returned 404 and an
unauthenticated keeper request returned 401. The 66-file upload excludes
private test state. In the user's Chrome session on the canonical domain, the
normal account balance card and the existing solo demo were checked directly:
the demo account dialog shows all three funded wallets at 20 USDC each.
No contract, server secret or hosting configuration changed.

### Previous bank-cancellation release — September 20, 2026

Source `475d913` adds cancellation of unsigned bank-funded dues workflows in
this browser. The form unlocks and history retains the original bank reference,
receipts, read-only status checks and explicit resume. It does not reverse a
bank transfer. Late responses preserve the stop; signed contributions remain
available for reconciliation. Bank processing returns control promptly instead
of keeping the user in a long polling loop.

47 web tests, formatting and the TypeScript/Vite build passed. The 32-page
TR/EN, theme and viewport browser suite and eight cancellation accessibility
scenarios passed locally and on the canonical HTTPS domain. The cancellation suite uses controlled bank fixtures
to test in-flight cancellation, reload persistence and same-reference resume
without transferring funds.

The actual Vercel build passed, the protected candidate returned the expected
bank identity, and the deployment was promoted to the canonical domain. Its
HTML, all 17 JS/CSS assets and public video match the local build. Source/private
probes return 404 and unauthorized `/api/settle` returns 401. The upload
allowlist contains 65 files. An actual unfunded bank order remained
`pending_user_transfer_start` after read-only checks against the canonical API;
an unsupported `cancel` action returned 400 without initiating a transfer or
contribution. No contract, server key or hosting configuration changed.

### Previous demo-entry release — September 20, 2026

Source `73d4825` makes Solo demo prominent beside the theme toggle and adds a
68-second silent product tour at `/walkthrough.mp4`. The README's screenshot
and video use actual testnet data; the tour is a view of an existing completed
expense, not a freshly completed bank transfer.

37 web tests, formatting and the TypeScript/Vite build passed. The 32-page
TR/EN, desktop/mobile, light/dark browser suite passed locally and on the
canonical HTTPS domain. 24 additional header scenarios at 320–1440 pixels
checked layout, dialog opening and keyboard focus restoration; eight header
accessibility audits passed.

The actual Vercel build completed and the protected candidate returned the
expected bank identity. After promotion, canonical HTML, all 17 JS/CSS files
and the MP4 matched the tested local build. The video is served as `video/mp4`.
Source/private probes returned 404; unauthenticated `/api/settle` returned 401.
The upload allowlist contains 64 files. No contract, bank key or hosting
configuration changed.

### Previous demo/error UX release — September 20, 2026

Source `b519217` is on `main`; the actual Vercel build passed. The candidate bank identity remained unchanged. Advancing the reported existing expense returned a structured `needs-review` / `QUOTE_EXPIRED` result, not a raw contract error; its quote had already expired and no replacement order was created. The canonical domain's HTML and all 17 JS/CSS assets match the tested local build. Source/private paths return 404 and unauthenticated `/api/settle` returns 401. The public HTTPS account screen shows the passkey-free demo entry and the updated device flow.

37 web tests and the TypeScript/Vite build passed. A sample-IBAN expense completed 100 simulated TRY with 2.0601077 USDC actually spent under a 2.27 USDC cap, receipt **FAST-NVXJ9O5Y48**. On-chain recipient and bank-reference hashes match. Evidence: `deployments/building-demo-ux-testnet-v3.json`. The fresh empty-treasury case blocked an unaffordable expense and started test funding from the same dialog. Its external anchor deposit remains `pending_anchor`; the tested UI shows a saved/pending notice rather than claiming completion. Physical Windows Hello was not tested. No Vercel secrets or contract bytecode changed.

### Previous UX release — September 20, 2026

Source commit `c285dec` is on `main`. The actual Vercel install and TypeScript/Vite build passed, and the protected candidate returned the expected bank identity/testnet network and the normal building's empty dues ledger. After promotion, the public canonical domain served identical HTML and all 17 JavaScript/CSS assets to the locally tested build, including both lazy QR scanner chunks. Bank configuration remained correct, private/source probes returned 404, and unauthenticated `/api/settle` returned 401.

On the public HTTPS site, a blank name stayed on the first step, a normalized name appeared before the explicit passkey action, and a QR image decoded to a verified building preview before navigation. The browser reported no warnings/errors during these checks. Local verification covered 31 web tests, mobile/desktop UX checks and a 100 simulated TRY expense using the saved manager IBAN and automatic 2.27 USDC cap; public testnet evidence is in `deployments/building-ux-testnet-v3.json`. Physical camera and biometric signing remain untested for this revision. No Vercel secrets were changed.

### Earlier V3 and dues verification

The cloud build completed with the actual install commands. Candidate `/api/bank` returned the expected bank public address and testnet network, and authenticated `/api/settle` returned its queue successfully. The final candidate was promoted to the public canonical domain. Its JavaScript/CSS exactly match the locally tested build; private/source paths return 404 and unauthenticated settlement returns 401. On the actual HTTPS origin, 32 page scenarios and 16 dialog accessibility/focus scenarios passed; passkey account creation, normal building creation, bank-funded dues and vote changes also passed. Public proof verification checks local/deployed WASM, nine successful chain receipts, immutable factory, clock configuration, smart-account votes, bank payment and reserve backing:

```sh
cd duly
node scripts/verify-building.mjs
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:browser
# Explicit live testnet scenarios, with private recovery state retained locally:
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:live
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:dues
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:passkey
```

`test:passkey` uses a virtual CTAP2 authenticator with real WebAuthn/testnet operations, not physical biometric hardware. A physical phone and installed wallet signature still require hands-on validation. Legacy V2 scripts are named `test:legacy:*` and target the archived interface.

References: [CLI deployment](https://vercel.com/docs/projects/deploy-from-cli), [upload allowlists](https://vercel.com/docs/deployments/vercel-ignore), [cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [cron limits and precision](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Final production verification: the public HTTPS solo flow completed 200 simulated TRY → 4.0792181 test USDC → 100 TRY IBAN payment (**FAST-J83IBKWCYF**). A separate 50 TRY payment completed with the browser closed through one authenticated Vercel keeper call (**FAST-ECU8EIOYRL**); retry left the treasury balance unchanged. The public-domain passkey account/building/dues/proposal/vote-change test passed against the final WASM. Allowlisted evidence: `deployments/building-production-testnet-v3.json`. Run `node scripts/verify-building.mjs building-production-testnet-v3.json` to verify it independently.

The dues update adds `/api/dues` to the same server-only deployment. Candidate checks matched the deployed bank and read the existing three-record dues index exactly. The production domain serves the same JS/CSS bytes as the tested local build. Source/private probes returned 404 and unauthorized `/api/settle` returned 401. No new Vercel secrets are required. Public contribution/index evidence is retained in `deployments/building-dues-testnet-v3.json`; see `stories/03-monthly-dues.md` for trusted-adapter boundaries and historical reconciliation limits.

Production dues verification passed on **https://duly-sepia.vercel.app**: a fresh solo building loaded one-time test funds without paying dues, contributed 5 and 1 USDC for two apartments, and paid 50 simulated TRY for a third. All three credits survived reload and were visible from another browser; receipt replay created no extra credit. Paid/partial filtering, mobile light/dark accessibility and the separate 32 TR/EN/theme/viewport/page suite passed. Public proof: `deployments/building-dues-testnet-v3.json` (seven local/production receipts, including a normal passkey building). Deployment: `dpl_HU1WEbg9b7yWWmqqqVZob4jid2u5`.
