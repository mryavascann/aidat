# Aidat — agent handoff

Give this file to any new agent or teammate. It carries the working rules and the durable context; the current state lives in `docs/agent-notes.md`. Nothing else should need re-explaining.

Paths: the git root is the folder that contains `aidat/`. The jury-facing `README.md` lives at the git root (see §9); everything else lives in `aidat/`.

## 1. Catch up first

Before doing anything else:

1. Read `docs/agent-notes.md`: Status, Decisions, Verified on testnet, Open issues, Gotchas, Next steps.
2. Read `docs/handbook.md`, the organizers' handbook. **It is the plan of record: where anything, including this file, disagrees with it, the handbook wins.**
3. Check the real state: `git status`, `git log --oneline -15`, and what exists under `aidat/contracts`, `aidat/scripts` and `aidat/web`. If the notes and the repo disagree, trust the repo and fix the notes.
4. Report to the user in 2–4 lines: where we are, what you will do next, anything blocking. Then do what the user asked; if they only said "continue", take the first unfinished item in Next steps.

## 2. Working rules

- Start every message to the user with the word **"Kanka"**. Talk to the user in Turkish: short, direct, and with proof of what you did (tx hashes, test counts, screenshots).
- Files are English only: code, comments, identifiers, commit messages, README, `docs/`, script output, contract error names, agent notes. The only Turkish in the repo is UI copy, and it lives only in `aidat/web/src/i18n/tr.ts`, never inline in components.
- Run commands yourself; never ask the user to run them. Use non-interactive flags. Hand over only what you truly can't do (a password, a Windows UAC prompt), with a one-sentence reason.
- Never claim an integration works from assumption. It works when it ran on testnet; record the tx hash in the notes.
- Tests first: write the contract test scenarios before the contract functions.
- Code is commented and modular; keep the folder structure flat.
- Design decisions (colours, type, layout, UX) live only in `docs/brand.md`. Write it before any UI work; components follow it.
- No git commits or pushes unless the user asks. Add key files (`.aidat-*-key`) and `.aidat-contract-id` to `.gitignore` the moment they are created.
- UI: Turkish, amounts in ₺ first, USDC only as a secondary figure. Keep crypto jargon (addresses, hashes, "transaction") out of the resident's view; give each item a quiet "view on chain" link for the jury.
- Update `docs/agent-notes.md` after every important step. Anything not written there does not exist for the next agent.

**Before you hand over** (or when the user switches agents): update agent-notes — Status, Verified on testnet with tx hashes, Open issues, Next steps — and mention uncommitted work and anything still running (for example a dev server).

## 3. Product

**Aidat — a transparent shared treasury.** Apartment, estate and association dues usually sit in one person's bank account: nobody sees the balance, spending isn't audited, the account can vanish when the manager changes, and the money loses value while it waits. Aidat moves the fund on chain. Members pay in lira from their IBAN through a TRY anchor, everyone sees the balance, and every expense goes proposal → quorum approval → payment straight to the payee, who cashes out in lira through the same anchor. The contract can't pull anyone's money: a contribution is a transfer the member signs, and a payout moves only after quorum.

Positioning: invoice financing, POS, yield/savings and freelance escrow are crowded; a group treasury with a fiat rail is empty. Aidat sits in that gap. Pitch and portal copy: `docs/pitch.md`.

## 4. What the jury checks

From the handbook; details and how we meet each point are in `docs/agent-notes.md` → Decisions.

- Three mandatory requirements: an eligible integration (Eligible Integration Partners list or the full SCF Integration List), an anchor / local-payments flow (lira in and a usable balance out, or the reverse), and an integration that is load-bearing.
- Criteria: real problem and impact · technical (deployed on testnet, nothing mocked, correct Soroban auth and storage) · ecosystem fit (the anchor flow weighs most, the integration is fundamental, Stellar Skills are cited) · non-crypto UX · traction (validated with real people at the event, a roadmap, a next step such as SCF / InstaAward) · presentation and documentation (the README and the demo explain the project).
- Deliverables: public GitHub repo, README, testnet contract(s), front-end URL, public live demo, documented contract IDs, the official pitch template, and the portal form with Genesis ticked. Deadline: **2026-09-20 12:00** (Istanbul).

## 5. Technical decisions

| | |
|---|---|
| Contract | Soroban, Rust, `soroban-sdk` 27 (what `stellar contract init` uses with stellar-cli 28), target `wasm32v1-none` |
| Scripts | Node + `@stellar/stellar-sdk` (17.1.0 was latest on 2026-09-19): deploy, anchor round trip, demo |
| Web | Vite + React + TypeScript. Wallet: "Quick start" (browser key in localStorage) + Stellar Wallets Kit 2.x (2.6.0; Freighter / xBull / LOBSTR / Albedo) |
| Network | Stellar testnet (`Test SDF Network ; September 2015`) |
| RPC / Horizon | `https://soroban-testnet.stellar.org` / `https://horizon-testnet.stellar.org` |
| USDC | Circle testnet issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`; derive the SAC address with `stellar contract id asset` |
| Anchor | `https://tr-mock-anchor.fly.dev`: sandbox TRY anchor from the hackathon's anchor workshop (Kaan Kacar); no API key, the SEP-10 signature is the identity; docs at `/guide` |
| Load-bearing integration | DeFindex vault for the idle treasury (§8) |
| Accounts | admin (`.aidat-admin-key`), member (`.aidat-testnet-key`), payee (`.aidat-payee-key`, the elevator company): generate, fund via friendbot, open a USDC trustline |
| Contract ID | written to `.aidat-contract-id` after deploy; `web/src/lib/config.ts` and the README take it from there |

## 6. Contract design (`aidat-treasury`)

Functions: `init(admin, token, name, dues_try, quorum)` · `set_dues` · `add_member` · `create_invite(code_hash: BytesN<32>, uses, ttl_ledgers)` · `join(member, code: Bytes)` · `contribute(from, amount)` · `propose(proposer, payee, amount, description) -> id` · `approve(member, id) -> approval count` · `execute(id)` · `cancel(id)` · `record_payout(id, anchor_memo, rate, ttl)` · views: `config`, `members`, `balance`, `contribution`, `proposal`, `approvals`, `proposal_count`, `payout_intent`, `invite_uses`. Admin handover (`set_admin`) is an open question; see agent-notes → Open issues.

Storage: `instance` holds the config, member list and proposal counter. `persistent` holds contributions, proposals and approvals, with the TTL extended on every read. `temporary` holds the payout intent (it lives as long as the anchor quote) and invite codes (they expire on their own). Dues are in kuruş (`dues_try`); contributions are USDC in stroops. The proposer's approval counts automatically. Errors are a numbered `contracterror` enum; their Turkish texts live only in `web/src/i18n/tr.ts`.

Tests to write before the code: init and double init, adding members and authorization, invites (create, use, expiry, use count), contribute (non-member rejected), propose → approve → quorum → execute, double approval rejected, insufficient balance, cancel, payout intent TTL, correctness of the views.

## 7. Anchor integration (per `tr-mock-anchor.fly.dev/guide`)

- Rate: `GET /health` → `rates.buy_rate` / `sell_rate` (Reflector USD/TRY + 50 bps). Use **buy** for deposits and **sell** for withdrawals and for showing the treasury in ₺. No CoinGecko: the anchor's rate is the rate actually applied.
- Deposit: SEP-10 → (optional SEP-12 PUT) → SEP-38 `POST /sep38/quote` (`sell_asset iso4217:TRY`, `buy_asset stellar:USDC:<issuer>`, `context sep6`) → `GET /sep6/deposit?asset_code=USDC&account=G…&funding_method=bank_account&amount=<TRY>&quote_id=…` → show the IBAN and reference → in the sandbox, `POST /sep6/tx/{id}/simulate-bank-transfer` → poll `/sep6/transaction?id=` (`pending_user_transfer_start → pending_anchor → completed`; watch for `pending_reason: treasury_low`; claim it if a `claimable_balance_id` appears) → `contribute(amount_out)`.
- Withdraw: quote (`sell_asset` USDC) → `GET /sep6/withdraw?…&amount=<USDC>&quote_id=…` → `account_id` + `memo` (type id, required) → send the USDC payment with that memo → poll → `external_transaction_id` is the bank reference. If SEP-12 has a `bank_account_number` (a TR IBAN, mod-97), the payout goes there.
- History: `GET /sep6/transactions?asset_code=USDC`.
- Limits: deposits 50–3,000 TRY, withdrawals from 1 USDC. **`amount` is TRY for deposits and USDC for withdrawals.**
- Mainnet: only the network passphrase and the home domain change.
- After a deposit no USDC should stay in the member's wallet; all of it goes to the treasury. Show "withdraw to TL" only at ≥ 1 USDC (the payee's case).

## 8. DeFindex (load-bearing integration)

Idle USDC in the treasury goes into a DeFindex vault (`invest` / `divest`); `execute` divests automatically when cash is short. Don't write this from guesses: first confirm a testnet vault that works with Circle testnet USDC, and its interface (mentors, DeFindex docs, the DeFindex SDK skill `defindex-sdk-skill.md` in `paltalabs/defindex-sdk`). If DeFindex testnet isn't usable, fall back to another eligible protocol that can be load-bearing for the idle fund, e.g. Blend v2.

## 9. README standard — the jury reads it first

The organizers told us the jury judges the project from the README and the demo, so it has to be excellent. Rules:

- It lives at the **git root**, the page GitHub shows first. English.
- Only true, checked content. At submission there are no placeholders, "TODO", "coming soon" or empty headings: a section exists only once its content is real. Add each section when its step lands (with its proof), then polish before submission.
- No filler: no generic blockchain or Stellar explainers, no marketing adjectives, no boilerplate sections (contributing, code of conduct, badge walls). Every line must help a judge understand, try or verify the project.
- Every claim is verifiable: contract IDs, tx hashes and the live demo are links (stellar.expert testnet, the app URL); code claims point to file paths.
- Numbers only with a source: the event survey, measured fees, cited statistics.
- Commands are copy-paste runnable and tested on this machine.
- The same facts and wording as the deck and the portal (`docs/pitch.md`).
- Scannable: short paragraphs, tables for IDs and proof, one Mermaid diagram, at most three screenshots or GIFs. A judge gets what, why and proof from the first screen.

Section order (leave out any section that has no real content yet):

1. Title, one-line value proposition, links: live demo · deck · contract on stellar.expert (· demo video if we have one).
2. Try it: how a judge runs the whole flow on the live demo in a few minutes (quick start, sandbox bank transfer, where to click). One line saying the UI is Turkish.
3. Problem and solution, in 3–5 sentences.
4. How it works: the user flow as numbered steps, with one or two screenshots.
5. Architecture: the Mermaid diagram and a components table (component → responsibility → path).
6. Stellar integration: the anchor flow (SEPs used), DeFindex, USDC, Wallets Kit; Soroban auth and the storage split (instance / persistent / temporary) and why.
7. Deployed on testnet: contract ID(s), wasm hash, and a proof table (deposit, contribute, propose, approve, execute, withdraw, invest / divest) with links.
8. Design decisions and trade-offs, one line each: decision, why, trade-off.
9. Challenges and how we solved them, real ones only.
10. Run locally and test: prerequisites and the exact commands (contract tests, build, deploy, scripts, web).
11. Stellar Skills used, by path (the handbook's paths).
12. Traction and next steps: real numbers from the event, the roadmap, the next step (SCF / InstaAward).
13. Team.

## 10. Target repo layout

```
<git root>/
  README.md                               jury-facing README (§9)
  CLAUDE.md                               loads this file into every Claude Code session
  aidat/
    HANDOFF.md                            this file
    contracts/aidat-treasury/src/lib.rs   Soroban contract
    contracts/aidat-treasury/src/test.rs  tests (write these first)
    scripts/anchor-e2e.mjs                full SEP-6 round trip; --only=deposit|withdraw --try=200 --usdc=2 --key=<file>
    scripts/demo.mjs                      add member → pay dues → propose → approve → execute (SDK)
    scripts/deploy.mjs                    deploy + init
    scripts/lib/soroban.mjs               keyAt / send / readAs / trustline helpers
    web/                                  Vite + React + TS
      src/i18n/tr.ts                      the ONLY file with Turkish UI strings
      src/lib/config.ts                   contract ID, network, anchor domain, explorer links
      src/lib/stellar.ts                  read (simulation, no wallet), call (sign + send), payAnchor, claimBalance, error mapping
      src/lib/anchor.ts                   SEP-1/10/12/38/6 client, describeStatus
      src/lib/wallet.ts                   quick-start key + Stellar Wallets Kit
      src/lib/invite.ts                   invite code generate / hash / URL (?davet=CODE)
      src/lib/format.ts, labels.ts        currency formatting; address → unit labels (localStorage)
      src/App.tsx                         shell; tabs Expenses / Ledger / Bank
      src/components/                     PayDues, Withdraw, ProposeExpense, ExpenseList, Ledger, Invite (QR), JoinCard, BankHistory, Onboarding, ui
    docs/handbook.md                      organizers' handbook (plan of record)
    docs/agent-notes.md                   current state (read first)
    docs/pitch.md                         pitch and portal copy
    docs/brand.md                         design decisions (write before UI work)
    docs/architecture.md                  optional depth; the README carries the architecture
```

## 11. Things to watch

- `scValToNative` returns a Soroban enum as an **array** (`["Pending"]`); comparing it to a string is silently false. Normalize in the read layer.
- Wallets Kit 2.x has a **static** API: `StellarWalletsKit.init / authModal / signTransaction`; modules come from `@creit.tech/stellar-wallets-kit/modules/<name>`.
- Read-only contract calls need no source account: simulate with `new Account(<any G…>, '0')`. That is what makes viewing without a wallet possible.
- The web app must work well on phones: the invite QR gets scanned in the room.
- Windows dev machine: see agent-notes → Gotchas (MSVC toolchain; the non-ASCII profile path breaks the wasm optimizer).
- Inside a Claude sandbox (macOS): Node `fetch` ignores the proxy, so run scripts with `NODE_USE_ENV_PROXY=1` (put it in the npm scripts; it is harmless elsewhere). `stellar-cli` can't reach the network from the sandbox, so deploy with the SDK-based `deploy.mjs`. `brew` and `rustup` can't install from the sandbox. `.claude/` and `~/.config` aren't writable. The cargo registry can't write `.gitmodules`, so set `CARGO_HOME=$TMPDIR/cargo-home`.

## 12. Run targets

```bash
cd aidat/web && npm install && npm run dev        # http://localhost:5173 (--host: LAN, scan the QR from a phone)
npm run anchor:deposit && npm run demo && npm run payee:withdraw   # from aidat/: script proof
cargo test -p aidat-treasury && stellar contract build             # from aidat/ (Windows: see agent-notes → Gotchas)
```
