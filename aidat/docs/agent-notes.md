# Agent notes

The current state of Aidat. The working rules and durable context are in `aidat/HANDOFF.md`; give that file to any new agent. Anything not written here or in the repo does not exist. Update this file after every important step.

Last updated: 2026-09-19, Day 1, before any code.

## Status

- Toolchain verified on the Windows dev machine (see Gotchas): Rust 1.98.1 (MSVC) with `wasm32v1-none`, stellar-cli 28.0.0, Node 24.19 / npm 11.17.
- Testnet RPC, Horizon and the TRY anchor (`tr-mock-anchor.fly.dev`) are reachable. Anchor `/health` on 2026-09-19: USDC/TRY buy 49.026 / sell 48.539 (Reflector mid 48.783, 50 bps spread); deposits 50–3,000 TRY, withdrawals from 1 USDC.
- Docs so far: `docs/handbook.md` (the organizers' handbook, plan of record), `docs/pitch.md` (pitch and portal copy, draft), `aidat/HANDOFF.md` (agent handoff), and `CLAUDE.md` at the git root, which loads the handoff into every Claude Code session.
- No contract, scripts or web code yet. No testnet accounts yet. No README yet, on purpose: it is written section by section as real content lands (`aidat/HANDOFF.md` §9).
- GitHub: https://github.com/mryavascann/aidat, **private** for now (created 2026-09-19); `main` is pushed. The teammate works from here as a collaborator. `.gitignore` covers key files, the contract ID, `.env`, `target/`, `node_modules/` and `dist/`.

## Decisions

- **The hackathon handbook (`docs/handbook.md`) is the plan of record.** The original handoff prompt is secondary; where the two disagree, follow the handbook. The changes this caused are marked "(handbook)" below.
- Deadline: submit by **2026-09-20 12:00** (Istanbul). Only finalists present live (Genesis demo day 13:00–14:30), so the README, the live demo and the deck must convince on their own.
- The three mandatory requirements (handbook) and how Aidat meets them:

  | Handbook requirement | Aidat |
  |---|---|
  | Integration: a protocol from the Eligible Integration Partners list, or any protocol from the full SCF Integration List | DeFindex vault for the idle treasury (planned; see Open issues). Stellar Wallets Kit stays for wallet connections but is not our core integration: the quick-start browser key works without it, so it is not load-bearing. |
  | Anchor / local payments: real lira in and a usable balance out, or the reverse | TRY anchor round trip. Deposit: SEP-10 → SEP-38 quote → SEP-6 deposit (TRY → USDC) → `contribute`. Withdraw: the payee sends USDC → TRY to their IBAN (SEP-6 withdraw). Highest weight in Ecosystem Fit. |
  | Core feature: the integration is load-bearing, part of what the product does | The vault is part of what the treasury does: idle USDC earns yield (the answer to "the fund loses value while it waits"), and `execute` divests automatically when cash is short. |

- (handbook) DeFindex moves from the optional step 6 of the handoff prompt to a required milestone, pending the mentor check below.
- MVP deliverables (handbook): public GitHub repo, well-structured README, Soroban contract(s) deployed on testnet, front-end URL, a publicly accessible live demo, documented contract IDs and deployed artifacts. Real functionality only: nothing mocked or hardcoded.
- (handbook) The README is the technical document; no separate one is required. The organizers stressed that the jury judges from the README, so it must be excellent: no empty and, above all, no unnecessary content. It lives at the git root (the page GitHub shows first) and follows the README standard in `aidat/HANDOFF.md` §9. `docs/architecture.md` is optional extra depth, not a substitute.
- (handbook) Stellar Skills: cite by path only the files we actually used. Official skill files listed in the handbook:
  - Anchors: `SKILL.md` in `CheesecakeLabs/stellar-anchor-skill`
  - SEPs, CAPs & Ecosystem: `skills/standards/SKILL.md` in `stellar/stellar-dev-skill`
  - DeFindex SDK: `defindex-sdk-skill.md` in `paltalabs/defindex-sdk`
  - Also listed: Stellar Integration Finder, Soroswap SDK, SCF Submission Radar, Stellar Scout (links in `docs/handbook.md`)

  The handoff prompt's `skills/anchors/SKILL.md`, `skills/defindex/SKILL.md` and `skills/smart-contracts/SKILL.md` are not handbook paths; don't cite them unless verified.
- (handbook) Pitch: the official template (Cover, The Solution, PMF, Technical Workflow, The Team), copied, with its structure intact; extra slides go after it. The copy lives in `docs/pitch.md`. The template's cover still shows an older date ("June 2–3").
- (handbook) Portal: team name, full names and contacts of every member, GitHub / live demo / deployment links, deck link, and the **Genesis** track ticked (projects are judged only in the tracks selected). Genesis teams have up to 4 people.
- (handbook) Traction: the organizers count teams that shipped a core-feature integration, an anchor integration, real traction and real onboarded users. Validate with real people during the event (room survey in `docs/pitch.md`) starting Day 1, then onboard the room by QR once the app is live.
- Passkeys and smart wallets are bonus features only (handbook).
- Unchanged from the handoff prompt: Soroban/Rust contract, Stellar testnet, Circle testnet USDC, the workshop TRY anchor, Turkish UI with ₺ first and USDC second, English everywhere else, tests before contract code.

## Verified on testnet

Nothing yet.

## Open issues

- DeFindex on testnet: we need a USDC vault that works with Circle's testnet USDC, plus its interface. Ask the mentors (Day 1, 15:00–16:00) and read the DeFindex SDK skill. Fallback: another eligible protocol that can be load-bearing for the idle fund, e.g. a Blend v2 lending pool.
- Ask the mentors whether the workshop's sandbox TRY anchor (`tr-mock-anchor.fly.dev`, with `simulate-bank-transfer`) counts as the "real fiat rail".
- Admin handover: the pitch says the fund survives a change of manager, but the contract design has no `set_admin`. Add one (ideally quorum-gated) or drop the claim.
- The pitch numbers (lira depreciation, households in apartment buildings) need a source before they go on a slide.
- Judge path: a judge usually tries the live demo alone, but the quorum step needs a second member. Decide how one person can see the whole flow (e.g. a demo treasury where a scripted second member approves, or the demo script's tx links shown in the README).
- The repo is private, but the handbook requires a **public** GitHub repo. Make it public before submitting, only when the user says so; before that, check that no secrets were ever committed.

## Gotchas

Windows dev machine; the profile path `C:\Users\Buğra` contains a non-ASCII character.

- Rust must use the MSVC toolchain. The GNU toolchain's bundled `ld` can't open files under the profile path and fails with "ld: cannot find …rlib" / "-lkernel32". Installed: VS 2022 Build Tools (MSVC 14.44, Windows SDK 10.0.26100); rustup default is `stable-x86_64-pc-windows-msvc`.
- `stellar contract build` fails in its wasm optimization step ("optimization error: Failed to read module") when the path contains "ğ". Use `--optimize=false`, or build through the 8.3 short path: `stellar contract build --manifest-path C:\Users\BURA~1\Desktop\projeler\STELLA~2\aidat\Cargo.toml`. Keep scripts portable for teammates on macOS.
- PowerShell 5.1 `Set-Location` rejects the `~` short path; pass the short path as an argument instead.
- From the handoff prompt, still valid: `scValToNative` returns Soroban enums as arrays (`["Pending"]`); read-only calls can be simulated with `new Account(<any G>, '0')`; Wallets Kit 2.x has a static API; in the anchor flow `amount` is TRY for deposits and USDC for withdrawals.

## Next steps

In priority order, driven by the handbook requirements. Deadline: 2026-09-20 12:00.

1. Setup: accounts (admin, member, payee) funded by friendbot with USDC trustlines, and `docs/brand.md`. The `.gitignore` and the private GitHub repo already exist.
2. Contract: tests first (`test.rs`), then `lib.rs`; `cargo test` green; build; deploy and init on testnet; record the contract ID.
3. Anchor round trip on testnet (deposit TRY → USDC, withdraw USDC → TRY); record the tx hashes here and in the README.
4. Load-bearing integration: DeFindex invest/divest from the treasury, after the mentor check in Open issues.
5. Demo script: join → dues → propose → approve → execute end to end, with tx hashes.
6. Web app (Turkish UI, mobile first, no crypto jargon) and a public URL for the live demo.
7. Traction: room survey on Day 1; QR onboarding of real users once the app is live.
8. README at the git root per `aidat/HANDOFF.md` §9. Sections are added as steps 2–7 land, each with its proof; then a final polish, reading it as a judge would.
9. Deck from the official template using `docs/pitch.md`; make the repo public (with the user's OK); portal submission with Genesis ticked, before 12:00.
10. Bonus if time allows: passkeys / smart wallet, reading Reflector from the contract, `record_payout` UI.

Steps 4 and 6 can run in parallel (contract stream and web stream) once the contract interface is fixed.
