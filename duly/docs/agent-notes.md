# Duly — current state

Updated September 19, 2026. This is the continuation point for the Duly MVP: rebrand, vault integration, browser app, stellar-build design adaptation, dark mode and the requested 10k Websites/Higgsfield frontend refinement.

## Status

- Repository cloned into `/Users/samet/Desktop/stellerhackathon`. Implementation branch: `codex/treasury-foundation`; remote: `mryavascann/aidat`. The user explicitly requested committing and pushing the accumulated implementation on September 19. Read Git for the current revision and upstream state.
- The user fixed MVP scope: **collect contributions → approve together → follow the payment**. The subsequent frontend redesign supports this scope. Periodic billing, expanded administration, new currencies and yield products remain deferred; do not turn earlier suggestions into new feature work.
- Product/source directory, Cargo crate, npm packages, key-file names, scripts, logo, UI and documentation now use **Duly**. Existing keys were preserved. Only the GitHub URL, historical evidence and defensive old secret-ignore patterns retain the prior name. Turkish `aidat` remains the ordinary word for dues.
- V2 treasury, Circle-compatible DeFindex reserve, migration, CLI bank round trip and browser app are implemented and testnet-verified.
- The web app is Turkish/English, with responsive overview, expenses, bank payments, members, invitation QR, wallet chooser, real RPC balances/events and receipts. Testnet/simulated-bank context is persistent.
- Light/dark mode follows the device initially. The accessible top-bar switch persists a manual choice in `duly:theme`; the HTML bootstrap applies it before the app starts. Semantic colors cover pages, dialogs, bank recovery states, mobile navigation and the Wallets Kit chooser. No new product page or financial behavior was added.
- The user's `10k-websites-skill.zip` and all its references were reviewed. Its typography, composition, imagery, motion and QA guidance was adapted to the existing React app and narrow MVP. Design and authored TR/EN copy are recorded in `docs/planning/frontend-design-package.md`. The jade-glass hero comes from Higgsfield GPT Image 2.5 (1-credit preflight); 672/1008/1344px WebP variants are 7.5/13.1/30.0 KB. Raw art and the supplied skill remain outside Git and deployment. Manrope headings, DM Sans body and DM Mono labels are self-hosted. The contract and financial flows are unchanged.
- Inspected `kaankacar/stellar-build` at `40396f0946461b955091b15f0af9714d3a3ac8ae`: methodology, installer/config, upstream/license boundaries, UX/architecture/stories, security/deployment references and loop tests. Original Duly planning artifacts are in `docs/planning/`, with acceptance evidence in `docs/stories/01-guided-payments.md`. Root `.stellar-build/bmm/config.yaml` maps these paths. Global hooks, skills, Raven configuration and learning loops were not installed.
- Overview now prioritizes the current account's unfinished payments, eligible decisions, contributions or withdrawals. The bank page preserves payment history and shows three evidence-based stages, explicit expired/attention states and authenticated bank-status checking. Legacy browser orders are retained. Feature modules live in `web/src/features/`.
- Browser demo creates a separate treasury and three new test accounts. No CLI administrator secret enters the browser. Resident/admin/payee switching supports a single tester's full journey. This is functional testing, not real-user traction.
- On this Mac: Rust 1.98.1, Node 26.7.0, npm 11.19.0, `wasm32v1-none`, Chrome. The scripts deploy through the JS SDK; Stellar CLI is not required.
- A production build preview is running at **http://127.0.0.1:5173**. The public site is not deployed. Latest verification serves `duly/web/dist/`.

## Verification

- **30 Rust tests**, **12 Node script tests** and **10 payment-model tests** pass. Cargo formatting, Clippy with warnings denied and the release build passed for the unchanged contract.
- Browser production build and desktop/mobile navigation in both languages passed, including a 360px overflow check.
- Full browser test passed: create three test accounts and a treasury → obtain deposit quote → reload → resume the same bank order → contribute to vault → propose → second-member approval → automatic redemption/payout → exact-memo withdrawal → create an invitation → third account joins.
- Wallets Kit chooser displays Freighter, xBull and Albedo. Live signing in an installed external wallet was not available; browser-key signing is fully exercised.
- Automated WCAG A/AA checks passed in 24 scenarios: four pages plus wallet/demo dialogs at 1440px and 360px in both themes, with no detected violations. Browser screenshots were visually reviewed and saved under `docs/screenshots/`. This is automated coverage, not full manual certification.
- Sixteen additional desktop/mobile recovery scenarios passed accessibility checks in both themes. Fixtures cover history, expired orders, valid SEP-10 authentication for status checks, a settled contribution and completed receipts. Reload retains the observed status; switching accounts hides the previous history. No payment was submitted by the fixture test. These fixtures are separate from live testnet evidence.
- `test:theme` passed: before-app initialization, device changes, saved override, reload, keyboard toggle, TR/EN labels, 360px/768px layout and dark wallet chooser. A transient contrast failure caused by button background animation was fixed by removing that animation and rerunning recovery, theme and browser checks.
- After the Higgsfield redesign, production build, 10 model tests, browser navigation, theme checks, 24 accessibility scenarios and 16 recovery scenarios pass again. Visual review covers 1440/1280/768/375/360px in both themes; an independent reviewer checked all four English views at breakpoint edges. Missing-image fallback, live reduced-motion changes and 44px mobile controls pass. A keyboard check found and fixed modal focus escape/restoration; `test:browser` now checks forward/reverse Tab, Escape, trigger focus and reopening. No new payment was sent in this visual pass. See the design package for complete asset and QA evidence.
- Public proof verifiers read no keys. `npm run verify` checks **21** successful receipts plus deployment and vault backing. `node scripts/verify-browser.mjs` checks **13** receipts, three members, two votes, exact withdrawal memo and the independent browser treasury's backing.
- The full live browser journey was rerun after the earlier stellar-build design changes. `npm run verify:guided` independently verified its **13** receipts, three members, two votes, reserve backing and exact withdrawal memo. Public evidence: `deployments/browser-testnet-guided.json`. `npm run export:browser` recreates that allowlisted file from a completed private browser test; verify it afterward. The later Higgsfield visual refinement did not submit new payments.
- Browser test state is private and ignored under `web/test-results/`; generated public proof is explicitly allowlisted to addresses, hashes and amounts. Final scans found no secret-shaped keys in unignored files and no broken local documentation links.

## Deployed contracts and receipts

Canonical Duly treasury:
`CC7TIRVPWB4EFE7ZPA3JZZD2VC5ZDRAHFN6UURSGW4JNJISMKGMGTKUR`

Circle reserve:
`CBYR7JQC7XBG4TJIRVLZDTJZQE6UBGUZ7C5I4J64NPVNZ64YKBTLNUTG`

Circle USDC SAC:
`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`

- Factory creation: `58cd164bfed3297014148e2e929b47e2b88b4938df2eec08785020e0f18148ad`.
- V2 deployment: `3dbf9c99b612b1f7d1a3c35b0be2c60bca050df043274e1b52bb3d10e59c41ce`.
- WASM SHA-256: `ba49defc0fee7c77fa866999a6dce1a8784853726d613b41194e52e80ce7ec1f`. Published artifact: `deployments/duly_treasury_v2.wasm`.
- Migration payout: `12c83eac9a01b3f64411ecc54b206f33ac397f0977a70c1bd3d3a64f201407d0`; invest: `fc24c3f098154c5bd097d57dd0f4eb81b6dfc339ef3ecc70c1d42d2158078146`.
- Deposit/contribution: `e6e70f84c7ca14a5cebaf2fedfa1102ffaf03f314327327333d11af3948e3c5d` (4.0792181 USDC from TRY 200).
- Quorum payout and vault redemption: `7988608557950395fcdbda2010590a7078f2c3f33c134e39c4e1ec66c0ea91f3` (2 USDC).
- Withdrawal: `3787ff7a67b884975a4e869e8f06cf7db8cf25266fa88442f0ed1ef35fc44820`, TRY 97.08, sandbox reference `FAST-82FQF7QZO6`.
- Canonical final fund: **4.1584362 USDC**, entirely in vault backing. Old V1 treasury: **zero**. Original evidence and original WASM preserved in `deployments/archive/`.
- Independent browser treasury: `CCW4BMNERIHNDAIECXLK7TM7FQ4MHIBBG67REZTMDBCRRAF4ZPW2FZLQ`; final fund **2.0792181 USDC**; three members. Browser contribution `4bc8cf59a8aab69492b3e7b781c225b8c81d655df671c5f88eb04168c8aa9146`; withdrawal `b97843932aac02dfcc1778b8eba55273e630efb88b768925c7afa36d7eb5f909`; bank reference `FAST-IJNYNNT2NA`.
- Guided-design browser treasury: `CC4VOZNTZP4SPHX7WOYLO4AJKHHYGZBR4D63UQZHLNYLJW37OP62LBSG`; final fund **2.0792181 USDC**; three members. Contribution `2d23abac04507aef68eebabcc871c91b108aa01507204c712283ee41d0bb4d4e`; withdrawal `1b96687b224948c3716ca4f585920256a468f75c50fe8d1f2dfff3b3616be05f`; bank receipt `FAST-HERUY6L85Y`. The earlier private browser state was preserved as ignored `web/test-results/browser-state-before-stellar-build.json`.

Complete public account/config/receipt data are in `deployments/testnet.json` and `deployments/browser-testnet.json`. Do not copy private journals or browser storage into a report.

## Decisions and limitations

- The public reference DeFindex USDC vault uses a different token from Circle USDC. We created an actual Circle-compatible vault through the official factory, using an empty strategy list. Contributions enter it and expense execution redeems it. No yield/APY is claimed.
- Reserve upgradability is disabled, fee is zero, and the treasury's reserve address is immutable. An administrator sandbox deposit paid for the first 1,000 locked DeFindex share units; no community funds were lost in migration.
- Separate member signatures enforce quorum, but the administrator controls who can join. Membership governance and manager handover are not implemented.
- The anchor's bank settlement, bank account and KYC are simulated. Mentor acceptance of this workshop sandbox has not been established. Do not imply production fiat settlement.
- Only receipt-verified claims belong in README/deck. No attendee survey or real-user traction exists. Test identities are not users.
- Root README is the jury-facing technical document. `docs/pitch.md` contains aligned draft copy; the actual official deck needs team details and a public frontend URL.
- The GitHub repository is still private unless its owner changed visibility externally. Its old name remains in the remote URL. Do not make it public or rename the remote without the user's instruction.
- Wallets Kit's unused cross-chain dependencies retain low/moderate npm advisories. `@near-js/utils` is overridden to 1.1.0 to remove the vulnerable older base-x subtree. No high/critical findings remain in the current lockfile. Only the three selected Stellar wallet modules are loaded. Resolve remaining findings before production; do not force-downgrade Kit to its incompatible 1.x API.
- Expired/uncertain bank orders retain their reference. Recovery deliberately does not open a replacement payment automatically. Claimable-balance handling is implemented but has not been exercised by a live anchor settlement.

## Gotchas

- SDK 17 transaction hashes are `Uint8Array`; convert to hex explicitly. XDR union type names include `scvContractInstance` and `contractExecutableWasm`. Fields are properties and XDR serialization is `toXdr`; transactions retain `toXDR`.
- Soroban enums decode to arrays (`["Executed"]`). Normalize them before UI comparison.
- `getEvents` may return an **empty page with a cursor before reaching the latest ledger**. Follow the cursor; an empty first page does not mean no history.
- Cross-contract authorization applies to the next invocation. Query the vault share balance before registering nested `token.transfer` authorization, then invoke `deposit` immediately.
- Read simulations do not commit TTL renewal. Temporary records enforce explicit ledger expiry in addition to storage TTL.
- A native HTML dialog makes other DOM overlays inert. Close it before launching Wallets Kit's chooser.
- Vite dev serving denies `.duly-*`, `.aidat-*`, `.env*`, `.git`, private key files and certificates. The localhost preview serves only the production build.
- `--fresh` deliberately starts another CLI payment. Normal reruns resume or skip completed intents. Never delete the journal just to retry. Remove a crash-left file lock only after checking that no CLI payment process is running.
- Windows: use Rust MSVC and Cargo directly if a non-ASCII profile path breaks Stellar CLI's optional WASM optimizer. Browser tests use Chrome's Playwright channel. Full run commands are in README.

## Next work

1. Publish the completed frontend on an agreed host and test a public HTTPS QR invitation on a real phone. No public URL exists yet.
2. Check signing with an installed external wallet and a real phone. Quote-expiry and bank-action-required UX now have controlled fixture coverage; actual bank-assisted resolution/cancellation remains future work.
3. Confirm workshop sandbox acceptance with mentors; get actual team details and finish the official five-slide deck without invented traction.
4. Validate with real attendees and record consented, actual counts/quotes. Decide repository visibility before submission.
5. Submit the verified repository/demo/deck/deployment links with Genesis selected; handbook deadline: September 20, 2026, 12:00 Istanbul.

Production governance, account recovery, yield and anchor/security changes require a separate scope decision after MVP validation. They are not tasks for this release.
