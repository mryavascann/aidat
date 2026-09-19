# Duly on Vercel

Production testnet demo: **https://duly-sepia.vercel.app**. V3 implementation branch: [`codex/building-governance`](https://github.com/mryavascann/aidat/tree/codex/building-governance).

Vercel project `duly`, scope `sametgoc81tr-4111s-projects`. V3 build: [`dpl_D2NeST2o6Zs32brDM4eXkeicZvVK`](https://vercel.com/sametgoc81tr-4111s-projects/duly/D2NeST2o6Zs32brDM4eXkeicZvVK), September 19, 2026. Candidate URL: `https://duly-8cyoabymu-sametgoc81tr-4111s-projects.vercel.app`. Previous V2 publication details remain in `archive/deployment-v2.md`.

This deployment uses Stellar testnet and the simulated workshop bank. Publishing does not make these real funds or real bank transfers. Passkeys and browser storage are origin-bound: localhost, a candidate domain and the production domain have separate credentials and saved sessions.

## Build and publish

Run from the repository root. `vercel.json` sets:

- Install: `npm ci --prefix duly && npm ci --prefix duly/web`.
- Build: `npm --prefix duly run web:build`.
- Static output: `duly/web/dist`.
- Node server functions: `api/bank.mjs`, `api/relay.mjs`, `api/settle.mjs`, each with a 120-second maximum.
- Explicit public manifest inclusion for server tracing; runtime code imports the manifest directly.
- Once-daily keeper: `/api/settle`, 09:00 UTC (`0 9 * * *`).

The source upload allowlist includes 52 files: app, server adapters, passkey package, public manifest, shared browser-safe modules and build configuration. It excludes CLI keys, private state, test fixtures, Rust sources/WASM, design ZIP, raw artwork and local server. Only compiled frontend files are served as static resources; source and private-path probes must return 404.

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

The cloud build completed with the actual install commands. Candidate `/api/bank` returned the expected bank public address and testnet network, and authenticated `/api/settle` returned its queue successfully. The final candidate was promoted to the public canonical domain. Its JavaScript/CSS exactly match the locally tested build; private/source paths return 404 and unauthenticated settlement returns 401. On the actual HTTPS origin, 32 page scenarios and 16 dialog accessibility/focus scenarios passed; passkey account creation, normal building creation, bank-funded dues and vote changes also passed. Public proof verification checks local/deployed WASM, nine successful chain receipts, immutable factory, clock configuration, smart-account votes, bank payment and reserve backing:

```sh
cd duly
node scripts/verify-building.mjs
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:browser
# Explicit live testnet scenarios, with private recovery state retained locally:
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:live
DULY_URL=https://duly-sepia.vercel.app npm --prefix web run test:passkey
```

`test:passkey` uses a virtual CTAP2 authenticator with real WebAuthn/testnet operations, not physical biometric hardware. A physical phone and installed wallet signature still require hands-on validation. Legacy V2 scripts are named `test:legacy:*` and target the archived interface.

References: [CLI deployment](https://vercel.com/docs/projects/deploy-from-cli), [upload allowlists](https://vercel.com/docs/deployments/vercel-ignore), [cron security](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [cron limits and precision](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Final production verification: the public HTTPS solo flow completed 200 simulated TRY → 4.0792181 test USDC → 100 TRY IBAN payment (**FAST-J83IBKWCYF**). A separate 50 TRY payment completed with the browser closed through one authenticated Vercel keeper call (**FAST-ECU8EIOYRL**); retry left the treasury balance unchanged. The public-domain passkey account/building/dues/proposal/vote-change test passed against the final WASM. Allowlisted evidence: `deployments/building-production-testnet-v3.json`. Run `node scripts/verify-building.mjs building-production-testnet-v3.json` to verify it independently.
