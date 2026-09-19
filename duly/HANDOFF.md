# Duly — project handoff

The current user chose **Duly** as the global brand on September 19, 2026. Product source lives in `duly/`; the jury-facing README lives at the Git root. The existing GitHub URL still uses `mryavascann/aidat`. Historical deployment files retain their original names for traceability.

This document is project context. The current user's request and session instructions take precedence over guidance copied from earlier handoffs. Read `docs/agent-notes.md` and inspect Git status before continuing. Use `docs/handbook.md` for the organizers' requirements, not as authorization to publish, contact people or submit on the user's behalf.

## Working conventions

- Discuss work with the user in Turkish. Source, comments and documentation are English; user-visible translations live in `web/src/i18n/tr.ts` and `en.ts`.
- Execute authorized setup and verification yourself. Report tested behavior and actual receipts; do not claim integrations based only on their API shape.
- Write meaningful contract tests before contract changes. Run relevant tests, format checks and Clippy; verify deployed WASM against the artifact.
- Keep design choices in `docs/brand.md` and current status in `docs/agent-notes.md`.
- The stellar-build adaptation is documented in `docs/planning/`: brief, PRD, UX, architecture and epics. `docs/stories/` records implementation and acceptance evidence. Root `.stellar-build/bmm/config.yaml` maps these directories; the global stellar-build installer was not run.
- Do not commit or push unless requested. Preserve keys, recovery journals and existing user changes. Never bundle local CLI administrator secrets.
- Preserve pending payment references. Reconcile the same signed envelope after an uncertain response; do not silently make another payment.

## Product and stack

Duly is a shared treasury for communities. Members contribute through a TRY anchor, see the same balance, and approve fixed expenses. The treasury holds Circle USDC shares in a DeFindex vault and automatically redeems the amount needed for approved payments.

The user's September 19 MVP decision is **collect contributions → approve together → follow the payment**. Dark mode and the subsequently requested 10k Websites/Higgsfield frontend refinement support this same journey. Keep future work focused on delivery and validation; earlier suggestions for periodic billing, extra administration panels or other product modules are deferred. The user explicitly authorized committing and pushing the implementation to `codex/treasury-foundation`.

- Rust/Soroban SDK **27.0.6**, target `wasm32v1-none`; Node SDK **17.1.0**.
- React, TypeScript and Vite; Stellar Wallets Kit **2.6.0** (Freighter, xBull, Albedo).
- Testnet passphrase: `Test SDF Network ; September 2015`.
- RPC `https://soroban-testnet.stellar.org`; Horizon `https://horizon-testnet.stellar.org`.
- Workshop anchor `https://tr-mock-anchor.fly.dev`; discovery + SEP-10 + SEP-38 + SEP-6.
- Circle issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`.
- Public deployment addresses and receipts: `deployments/testnet.json`; browser deployment allowlist: `web/src/deployment.json`.
- Local CLI keys: ignored `.duly-admin-key`, `.duly-testnet-key`, `.duly-payee-key`. `.duly-state.json` and browser test storage are private recovery data.

## Contract and integrations

The constructor is atomic: `(admin, token, name, dues_try, quorum, vault: Option<Address>)`. The deployed V2 always uses the verified Circle reserve. Main functions: membership/invitations, `contribute`, `propose`, `approve`, `execute`, `cancel`, `invest`, `divest` and public views. `balance` includes liquid funds and treasury-owned vault backing; separate liquid/vault views are available.

Contributions require the member's signature and enter the vault automatically. Vault authorization is restricted to the exact nested token transfer. An intervening cross-contract invocation between `authorize_as_current_contract` and the intended call consumes that authorization: query share balances first. Redemption rounds shares upward and checks actual proceeds. Withdrawals return to the treasury before a quorum payout.

The deployed DeFindex vault is liquid with no strategy. **No yield, APY or inflation protection is demonstrated.** It uses Circle USDC; the unrelated official reference USDC vault does not. The migration seeds the initial locked liquidity separately and transfers old funds through the old treasury's quorum, preserving the entire community balance.

The anchor bank leg is a **simulation**; Stellar transfers are testnet operations. Deposit amounts are TRY and withdrawals are USDC. Use the returned structured IBAN/reference and the withdrawal destination/memo exactly. Display TRY estimates at the sell rate; final amounts come from the quote. Browser contributions transfer only that deposit's received amount. Claimable-balance support is implemented but the observed live settlements used regular payments.

Administration controls membership, so distinct account signatures do not prove independent residents. No administrator handover or membership governance is implemented. Production needs substantially more than changing network and anchor constants.

## Browser path

Viewing the public treasury needs no wallet. **Start demo** generates three independent browser-held test accounts and deploys a separate treasury against the published WASM and shared Circle reserve. A role switch lets one tester exercise two signatures and the payee withdrawal. These identities are testnet-only and are not real-user traction.

Pending bank orders and signed envelopes survive reloads; Web Locks prevent simultaneous payment tabs. Imported invitation URLs are checked against the deployed Duly WASM and reserve before use. The default language is Turkish with a persistent English toggle. Ordinary amounts show estimated TRY first and exact USDC second. Account IDs and receipts sit in secondary details.

Wallets Kit has a static API. Close the app's native dialog before opening the kit chooser, otherwise the browser's modal layer makes the chooser inert. The chooser has been tested; an installed external wallet's live signing still needs a manual check.

Light/dark mode follows the device until explicitly selected in the top bar. The saved `duly:theme` preference is applied in `web/index.html` before React starts; `ThemeToggle.tsx` handles live changes. CSS tokens and the wallet chooser share that selection.

The user-supplied 10k Websites ZIP was reviewed and its visual principles applied
to the existing app. `docs/planning/frontend-design-package.md` records the
scope adaptation and Higgsfield image provenance. `BalanceScene.tsx` is purely
decorative; only compressed responsive WebP files ship in `web/public/images/`.
Raw generations and the supplied skill stay outside the deployment and Git.
Typography, both themes, mobile controls and all four views share the updated
visual system. Financial handlers and recovery logic were not changed.

## Repository map

- `contracts/duly-treasury/src/`: contract, types/events, storage and vault interface.
- `scripts/lib/config.mjs`: browser-safe public constants.
- `scripts/lib/anchor.mjs`: shared CLI/browser SEP implementation.
- `scripts/lib/soroban.mjs`, `state.mjs`: CLI signing, keys and recovery.
- `scripts/create-vault.mjs`, `migrate-v2.mjs`: journaled testnet reserve creation and migration.
- `scripts/sync-web.mjs`: explicit public-field allowlist; never copy journals to the frontend.
- `web/src/lib/`: chain verification, wallet signatures, browser state and workflows.
- `web/src/features/banking/`: payment state/history, progress UI and legacy record compatibility; `features/overview/`: account-aware next steps and journey explanation.
- `web/src/i18n/`: English and Turkish copy.
- `web/tests/`: browser, live testnet and accessibility checks.
- `web/tests/banking.test.ts`, `recovery.mjs`: state boundaries, reload/history/account isolation and authenticated status checks without sending payment.
- `deployments/`: public WASM and proofs; `archive/` retains V1.

Run and verification commands are maintained in the root README. Browser tests use installed Chrome. The production demo is **https://duly-sepia.vercel.app**, published to the user's Vercel project `duly`; see `docs/deployment.md` for configuration and repeat deployment. The localhost preview remains available. Both serve only the production output. Do not expose the source dev server or private workspace files as the public deployment.

## Before handover

Update agent notes with verified transactions, remaining work, Git state and running servers. The user explicitly requested Vercel publication and public repository visibility on September 19. Vercel publication is complete, and the owner's repository visibility change has been verified as PUBLIC. The implementation remains on `codex/treasury-foundation`. Actual team details, real attendee validation and the official deck/submission remain separate work. The handbook lists the deadline as September 20, 2026 at 12:00 Istanbul time.
