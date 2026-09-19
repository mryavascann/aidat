---
title: Duly requirements
status: implementation-baseline
updated: 2026-09-19
---

# Product requirements

This baseline translates the current Duly implementation and the user's design request into verifiable behavior. Personas and journeys below are implementation scenarios; user research has not yet validated them. Product positioning is in [the brief](product-brief.md).

## Public viewing and orientation

- **FR-01:** A visitor can view treasury balance, reserve allocation, members, expenses and recent events without a connected wallet. Loading, unavailable rates and unavailable event history are explicit.
- **FR-02:** The overview explains collection, shared decisions and verifiable records. Its primary next step uses the connected account's saved orders, approval eligibility and wallet balance. A nonmember cannot be offered a member contribution as an enabled action.
- **FR-03:** The Duly brand is consistent. Turkish is the default; English is selectable and persists. The testnet/bank-simulation distinction stays visible.
- **FR-13:** Light/dark mode initially follows the device preference. An explicit top-bar choice persists across reloads, applies before the app loads and also themes the wallet chooser. Theme changes preserve the current page, payment and selected account.

## Contributions and withdrawals

- **FR-04:** A member can request a TRY deposit quote within the sandbox's limits and review the exact quoted output, expiry, bank reference and transfer instructions before the explicit simulation action.
- **FR-05:** A deposit is complete only after anchor settlement and the confirmed treasury contribution. The treasury receives only the amount from that order, never unrelated wallet funds.
- **FR-06:** A recipient can request a USDC withdrawal and confirm the exact amount/destination/memo. Completion requires both the confirmed Stellar payment and the sandbox bank receipt.
- **FR-07:** Quote, transfer and final settlement/contribution steps are visible. A completed anchor deposit awaiting a treasury signature is distinguishable from a completed contribution.
- **FR-08:** Unfinished orders survive reloads and retain their references. Resuming a Stellar transaction uses the same signed envelope. Unknown, expired and action-required bank statuses offer explicit status checking. Checking status authenticates to the anchor and never starts a new transfer.
- **FR-09:** Completed and unfinished orders are listed for the selected wallet and treasury in the current browser. Existing single-order storage remains readable. Opening a historical receipt never overwrites an unfinished intent.

## Shared decisions and membership

- **FR-10:** Members can propose a fixed recipient, description and USDC amount. Each eligible account votes once; the proposer supplies the first vote. Payment is available after quorum and executes at most once.
- **FR-11:** Administrators issue expiring invitations. Invitees sign their own membership transaction. A treasury imported by URL is checked against the published Duly code and reserve configuration.
- **FR-12:** Confirmed operations expose public Stellar receipt links. Technical identifiers are secondary details rather than prerequisites to understanding normal payment steps.

## Quality requirements

- **NFR-01 — financial precision:** Payment arithmetic uses decimal strings and integer base units. Rounded display values cannot determine payment amounts.
- **NFR-02 — recovery:** Save signed envelopes before submitting; keep unresolved orders. Web Locks prevent simultaneous payment execution by Duly tabs. A read failure must not display an old account's balance as the new account's balance.
- **NFR-03 — accessibility:** Keyboard navigation, dialog focus handling, status text, visible focus and a skip link are required. Verify the implemented screens in both themes at 360px and 1440px with automated WCAG A/AA checks; this is not a full manual accessibility certification.
- **NFR-04 — privacy:** Public manifests contain an allowlist of deployment data. Test secrets and recovery journals stay out of source control and production bundles. Browser demo keys are explicitly testnet-only.
- **NFR-05 — truthful state:** Do not claim live yield, real bank settlement, identity independence or monthly debt tracking. An account's contribution total does not establish a billing period's payment status.
- **NFR-06 — maintainability:** Banking state/history, payment presentation, overview guidance and chain signing have distinct modules. Tests cover transition boundaries and failure behavior.

## Demonstration scenarios

**Resident:** view balance → pay contribution → reload → resume the existing order → verify the contribution receipt. The saved reference and completed amount must survive.

**Administrator/member:** create an expense → switch to a distinct member → approve → execute → inspect payment. Buttons and the next-action card reflect who can act.

**Provider:** receive approved funds → quote a withdrawal → confirm the test transfer → inspect the bank receipt. An expired unsigned order is checked before any further payment.

**Interrupted user:** find the saved order in payment history → inspect its current stage → check the bank or resume the exact transaction. Do not create a replacement because a network response was missing.

## Explicit limits and follow-up

The user's September 19 scope decision is one MVP journey: contributions, shared approval and payment records. Dark mode is the only additional feature in this iteration. Periodic billing, expanded administration and new currencies are deferred; earlier suggestions are not an implementation backlog for this release.

History is browser-local, not an account-wide bank statement. Expired/action-required orders remain available for reconciliation; automatic cancellation/requoting and KYC forms are outside this iteration. The latest 50 proposals and a bounded event scan are displayed. Long-term indexing, audited production custody, real identity/membership governance, production anchors and multi-currency corridors need separate design and integration evidence.
