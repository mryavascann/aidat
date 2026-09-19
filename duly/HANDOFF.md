# Duly — project handoff

Updated September 19, 2026. Current implementation: **V3 fixed-seat building governance**, on `codex/building-governance`. Read `docs/agent-notes.md` and Git status first. Historical V2 context is preserved in `docs/archive/`; it does not describe the current product.

This file supplies project context. The current user's instructions take precedence. `docs/handbook.md` describes organizer requirements; it does not authorize submission, publication or contacting people.

## Working conventions

- Discuss work in Turkish; source, comments and documentation in English. V3 interface translations are in `web/src/i18n/building.ts`.
- Keep the MVP focused on dues → governed expenses → IBAN receipts. There is no service-provider role.
- Write meaningful contract tests before contract changes. Run the applicable tests, formatting and Clippy; compare deployed WASM with the actual artifact.
- Preserve keys, signed envelopes, bank references and browser recovery state. Never retry an uncertain transfer by creating another payment.
- The user explicitly authorized commit, push and Vercel publication in this session. GitHub's existing URL is `mryavascann/aidat`; the product name is Duly.
- Do not bundle administrator/bank keys, private journals, virtual-authenticator credentials or the supplied design ZIP.
- Keep current status in `docs/agent-notes.md`, implementation evidence in `docs/stories/02-building-governance.md`, hosting in `docs/deployment.md`.

## Accepted model

All apartments and initial owners are fixed at setup. Each seat has one vote; an owner can transfer it directly or delegate voting. Anyone may pay a seat's dues. The manager cannot create or remove seats. Manager replacement, budgets and approved recipients require apartment majority. Missing-owner recovery requires a document hash, majority of the other apartments and seven days for the old owner's veto.

The user chose **three days without objection** for new recipients and budget exceptions. A majority may approve earlier; any objection requires a majority. Approved recipients within the aggregate TRY and USDC budget can be paid without another vote or wait. Budget periods last **30 days from setup**, not calendar months. Limit changes do not erase spending. Both elapsed-time and ledger boundaries apply.

Separate demo bytecode shortens 3 days / 7 days / 30 days to 20 seconds / 60 seconds / 10 minutes. The solo demo creates three test seats and explicitly labels simulated votes; no role switching is needed. Normal timers cannot be changed by an administrator.

## Technical boundaries

- Soroban SDK 27.0.6, native `require_auth`, persistent versioned seats/votes and events. New crates: `duly-building` and immutable `duly-factory`.
- React/TypeScript/Vite. Smart Account Kit 0.8.0 needs SDK 16.3.0. Duly chain/server code imports SDK 17.1.0 through `@duly/stellar-sdk`; passkey integration crosses serialized XDR strings only.
- Pinned OpenZeppelin smart-account bytecode and WebAuthn verifier. `account.execute` returns void: extract inner proposal/building IDs from the successful receipt's matching contract events.
- Stellar testnet only. TRY bank settlement is simulated by the workshop anchor. A trusted server adapter receives treasury USDC in an isolated classic escrow, then makes the anchor's exact-memo payment to the specified IBAN.
- Exact signed envelopes are persisted. The automatic expense queue is AES-GCM encrypted in separate classic account-data records; sequence-based concurrent-write checks prevent stale writers. Public keeper responses contain no raw IBAN or sealed bank-flow token.
- Vercel `/api/settle` uses `CRON_SECRET`; the bank/sponsor uses `DULY_BANK_SECRET`. Frontend polling advances eligible queues; daily hosting fallback does not guarantee payment exactly at the deadline.
- Existing V2 funds, keys, receipts and journals remain intact. The active UI is V3; archived V2 source and the previous branch provide legacy reconciliation. Do not load V2 journals into V3.

The contract cannot verify legal title, the initial owner's identity or an IBAN's beneficial owner. Negative approval for over-budget proposals means the budget is not an absolute loss cap. Passkey integration is not independently audited; physical biometric hardware was not tested. No vault yield/APY is claimed. Mainnet, regulated banking, production wallet recovery and independent security review are outside this testnet MVP.

See root `README.md` for setup, the solo walkthrough and verification commands. Production demo: **https://duly-sepia.vercel.app**.
