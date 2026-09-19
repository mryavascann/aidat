---
title: Guided overview and recoverable bank payments
status: review
updated: 2026-09-19
---

# Story 01 — Guided payments

As a community member or service provider, I want Duly to show my next action and preserve each bank payment's progress, so that I can understand and resume my task without creating another transfer.

## Acceptance criteria

1. Overview guidance reflects connection, membership, unfinished orders and approval eligibility. Collection, decisions and proof are directly discoverable.
2. A deposit and withdrawal each show three stages, based on evidence; a settled deposit awaiting contribution is not displayed as complete.
3. Expired/action-required/unknown states preserve the order and offer bank-status checking. Checking status cannot create a quote or submit a Stellar payment.
4. History preserves completed receipts and unfinished orders, including old single-order keys, scoped to account and treasury.
5. A changed account clears old wallet values. A read failure displays unavailable.
6. The same recorded envelope resumes an uncertain transfer; a fresh withdrawal checks that its bank order still awaits funding.
7. English/Turkish, 360px/1440px layouts and automated accessibility checks pass. Existing contract behavior and live testnet journey remain functional.

## Tasks

- [x] Inspect reference source and capture Duly-specific requirements and decisions.
- [x] Extract banking model/presentation and overview components.
- [x] Implement timeline, scoped history, legacy compatibility and explicit status check.
- [x] Persist observed status before completion/failure; protect fresh withdrawal signing.
- [x] Implement account-aware next action, journey navigation and wallet reset.
- [x] Add boundary, storage and browser recovery tests.
- [x] Finish visual verification and testnet regression, record results.

## Implementation record

Reference revision and tradeoffs are recorded in [architecture.md](../planning/architecture.md). No upstream skill package, agent hook, market catalog or installer is part of the product runtime. The current contract deployment is preserved.

Changed areas: project-local `.stellar-build` config; `web/src/features/`; `App.tsx`, `lib/flows.ts`, i18n and CSS; shared `scripts/lib/anchor.mjs`; Node/browser tests; package test commands; project planning and handoff documentation. Private keys and previous test browser storage are preserved outside Git.

## Validation

All seven acceptance criteria have implementation and automated verification evidence:

- `npm test` in `duly/`: 12 script tests passed, including persisted terminal/unknown anchor observations and storage failure.
- `npm test` in `duly/web/`: 10 model tests passed, including expiry boundaries, partial settlement, history migration and account scoping.
- `cargo test --locked -p duly-treasury`: 30 existing contract tests passed. The contract ABI and artifact are unchanged.
- Web production build, desktop/mobile navigation in both languages and visual review passed. A mobile next-action layout overlap found during review was fixed and rechecked.
- `test:a11y` and `test:recovery`: 40 automated WCAG A/AA scenarios passed across light/dark themes and mobile/desktop sizes. Recovery checks include authenticated bank-status reading, reload persistence, no new payment submission, account isolation and 16 dialog/history accessibility scenarios. These use a stub anchor and runtime-generated disposable keys.
- The user's final MVP iteration adds only light/dark mode: early theme selection, device preference following, a saved explicit choice, keyboard operation, translated labels and wallet chooser theming all passed `test:theme`. Product expansion is deferred in [the brief](../planning/product-brief.md).
- `test:live`: the complete separate testnet journey passed with an actual deposit, treasury contribution, two approvals, payout, withdrawal and invitation join. Bank settlement remains simulated.
- `npm run verify:guided`: 13 successful receipts, membership, quorum, reserve backing and exact withdrawal payment verified independently. See [public proof](../../deployments/browser-testnet-guided.json).
- `npm run verify`: the canonical treasury's 21 receipts, WASM and vault backing still verify.
- Final unignored-file scan found zero secret-shaped keys and documentation links resolve locally.

No public deployment, production banking, real-user research or installed-extension signing is claimed. The user requested committing and pushing the accumulated implementation on `codex/treasury-foundation`; consult Git for the current revision and upstream state.
