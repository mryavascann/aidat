# Duly implementation epics

The acceptance criteria are derived from [prd.md](prd.md), not from assumed customer validation. The detailed current story is [01-guided-payments.md](../stories/01-guided-payments.md).

## E1 — Understand the community and the next action

**Requirements:** FR-01–03, FR-12–13, NFR-03, NFR-05.

- A visitor understands collection, decisions and receipts from the overview and can open each destination.
- Given an unfinished order for the selected account, the next-action card leads back to it.
- Given an expense needing this member's vote, the card leads to the expense list; nonmembers are never offered an enabled member-only contribution.
- Given a wallet switch, unavailable/stale balance data cannot be presented as the new account's funds.
- Light/dark mode follows the device initially, saves an explicit choice and preserves readable mobile/desktop screens and the current payment.

## E2 — Follow and recover a payment

**Requirements:** FR-04–09, NFR-01–02, NFR-04, NFR-06.

- Deposit and withdrawal dialogs show three evidence-based stages and a receipt only at completion.
- Given a settled deposit with an expired quote, the user can finish the treasury contribution without another bank transfer.
- Given an expired/unknown/action-required state, status checking keeps the same order ID and broadcasts no payment.
- Given legacy saved records and a later new payment, earlier receipts remain in history.
- Given another account or treasury, private local order history is absent.
- Given an interrupted transfer, the saved signed envelope remains the recovery path.

## E3 — Keep decisions and delivery verifiable

**Requirements:** FR-10–12, NFR-01, NFR-04–06.

Existing contract and browser behavior remains in scope for regression checks: signature requirements, quorum, exact payout, invitations, reserve redemption, public proof links and testnet/bank labels. This iteration does not deploy a replacement contract.

## MVP delivery

The user froze feature scope on September 19, 2026. Contributions, shared approval and payment records remain the single product journey; dark mode improves its existing screens. No further product epics are scheduled for this release.

Remaining delivery work is HTTPS hosting, actual-device wallet checks, real user validation and the official demo/pitch/submission. Production onboarding, expanded administration, periodic billing, new currencies and yield strategies are deferred rather than treated as current tasks.
