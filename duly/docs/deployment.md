# Duly on Vercel

Production testnet demo: **https://duly-sepia.vercel.app**. Implementation branch: [`main`](https://github.com/mryavascann/aidat/tree/main).

Vercel project `duly`, scope `sametgoc81tr-4111s-projects`. Current demo/error UX build: [`dpl_DMhRECzPfQoZQ2MvgBXcaX5eNTox`](https://vercel.com/sametgoc81tr-4111s-projects/duly/DMhRECzPfQoZQ2MvgBXcaX5eNTox), September 20, 2026, from source commit [`b519217`](https://github.com/mryavascann/aidat/commit/b519217). Candidate URL: `https://duly-8gn1ta8wp-sametgoc81tr-4111s-projects.vercel.app`. It replaces UX build `dpl_HJ391WDReMfHucWLBTF2bs2R6Na6` without changing contract addresses or server keys. Previous V2 publication details remain in `archive/deployment-v2.md`.

This deployment uses Stellar testnet and the simulated workshop bank. Publishing does not make these real funds or real bank transfers. Passkeys and browser storage are origin-bound: localhost, a candidate domain and the production domain have separate credentials and saved sessions.

## Build and publish

Run from the repository root. `vercel.json` sets:

- Install: `npm ci --prefix duly && npm ci --prefix duly/web`.
- Build: `npm --prefix duly run web:build`.
- Static output: `duly/web/dist`.
- Node server functions: `api/bank.mjs`, `api/relay.mjs`, `api/settle.mjs`, `api/dues.mjs`, each with a 120-second maximum.
- Explicit public manifest inclusion for server tracing; runtime code imports the manifest directly.
- Once-daily keeper: `/api/settle`, 09:00 UTC (`0 9 * * *`).

The source upload allowlist includes 63 files: app, server adapters, passkey package, public manifest, shared browser-safe modules and build configuration. It excludes CLI keys, private state, test fixtures, Rust sources/WASM, design ZIP, raw artwork and local server. Only compiled frontend files are served as static resources; source and private-path probes must return 404.

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

### Current demo/error UX release — September 20, 2026

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
