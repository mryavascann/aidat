# Fixed-seat building governance and bank recipients

Requested September 19, 2026. This request supersedes the earlier open-membership scope. Implementation is on `codex/building-governance`; V2 source, keys, balances and evidence remain preserved.

## Delivered acceptance scope

- Service-provider role removed from the active interface. A manager creates a TRY expense for a bank IBAN; the recipient needs no Duly account.
- 2–128 apartment seats fixed at initialization. No add/remove or unilateral administrative reassignment function exists.
- Owners sign transfers and delegation. A tenant or other payer can contribute without receiving a vote. Changed ownership/delegation invalidates stale votes; repeated votes replace the same seat's vote.
- Recovery: manager, document hash, majority of other seats, then a seven-day objection period. The existing owner may veto. Both elapsed time and ledger boundaries apply.
- Apartment majority elects/replaces the manager and approves budgets/recipients.
- The user's clarification selects **three days without objection** for new recipients and budget exceptions. A majority can approve early; any objection requires a majority. Approved recipients inside the remaining TRY and USDC budget can be paid immediately. Splitting ordinary invoices cannot silently overrun the aggregate budget.
- The user's clarification selects **30-day periods starting at setup**. Updating limits does not reset spent amounts.
- Permissionless execution runs the contract's checks and sends only the bank-attested quote amount. Disbursement and final simulated bank settlement are distinct states.
- Solo demo automatically creates three independent test accounts and a separate test treasury; simulated votes are labelled. Separate demo WASM uses 20-second / 60-second / 10-minute clocks. No production-timer setter exists.
- Real WebAuthn authorizes a pinned OpenZeppelin Stellar smart account through Smart Account Kit. Testnet fees are sponsored; no seed phrase is shown. Existing Stellar wallets are optional.
- Encrypted durable queue permits execution after browser closure. Exact-envelope reconciliation, bank references and sequence-based journal concurrency checks protect retries.

## Evidence

- **47 workspace Rust tests** (16 building, 1 factory, 30 legacy), plus **16 building tests under the demo feature**. Formatting and Clippy with warnings denied pass. New contract regression tests were written before implementation changes.
- **16 Node script tests** and **14 web model/server tests** pass. API tests cover authenticated encryption/tampering, body limits and rejection of unrelated sponsor bytecode.
- **32 browser scenarios** pass automated WCAG A/AA checks: TR/EN, light/dark, 1440px/360px, four views. Production build succeeds. The same 32 scenarios passed on the public HTTPS domain, as did 16 additional dialog accessibility/focus scenarios. This is automated coverage, not accessibility certification.
- Final-WASM solo test: 200 simulated TRY → **4.0792181 test USDC** contribution → 100 TRY new-IBAN expense → 20-second demo objection window → automatic payment and simulated bank receipt **FAST-MVXYNQXSA9**.
- Virtual CTAP2 test: real passkey smart account and normal two-seat building; bank → smart account → treasury contribution; proposal and yes → no → yes changes retain exactly one vote. Physical Touch ID/Face ID has not been tested.
- Closed-browser keeper test: 50 TRY expense settled; replay sent no extra payment; stale journal write rejected; public queue response disclosed neither IBAN nor recoverable bank-flow token. This test and the passkey test use the preserved initial V3 deployment; the final solo test uses the final WASM.
- Public proofs: `deployments/building-testnet-v3.json` and `deployments/building-browser-testnet-v3.json`. `node scripts/verify-building.mjs` independently checks successful receipts, deployed/local WASM, factory configuration, clocks, passkey seat tally, bank payment and reserve backing. It reads no private key and signs nothing.

## Trust and operating limits

Fixed seats prevent later seat inflation; the founder's initial register still needs independent validation. A document hash identifies content, not legal title. The contract cannot determine beneficial ownership of an IBAN. Because the selected policy permits unopposed budget exceptions, the budget is not an absolute loss cap.

Only the configured bank adapter attests quotes and settlement. Its intermediate custody and the fiat simulation are explicit. Bank-order expiry/failure retains the original reference; automated refund or replacement-order recovery is not implemented. Registered expenses progress while the app is open and through a daily Vercel fallback when closed; exact-deadline execution is not promised. Sponsorship/faucets are testnet services; production rate limits, funding and monitoring remain necessary.

The passkey integration and later upstream deployment are not automatically covered by an earlier library audit. Device recovery, passkey synchronization and real biometric hardware need further validation. There is no active vault yield strategy, production banking integration or real-user traction claim.

## Primary references checked

- [Stellar smart wallets](https://developers.stellar.org/docs/build/guides/contract-accounts/smart-wallets)
- [Soroban authorization](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization)
- [OpenZeppelin account policies](https://docs.openzeppelin.com/stellar-contracts/accounts/policies)
- [OpenZeppelin release v0.7.2](https://github.com/OpenZeppelin/stellar-contracts/releases/tag/v0.7.2)
- [Smart Account Kit](https://github.com/stellar/smart-account-kit): 0.8.0 requires SDK 16.3.x. Duly's SDK 17 types never cross into this adapter.
- [Workshop anchor guide](https://tr-mock-anchor.fly.dev/guide): SEP-12 supplies the bank recipient, and the payment watcher uses classic accounts and memos.
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing): this Hobby deployment uses a once-daily schedule, not a three-day exact-time scheduler.

Final production verification: the public HTTPS solo flow completed 200 simulated TRY → 4.0792181 test USDC → 100 TRY IBAN payment (**FAST-J83IBKWCYF**). A separate 50 TRY payment completed with the browser closed through one authenticated Vercel keeper call (**FAST-ECU8EIOYRL**); retry left the treasury balance unchanged. The public-domain passkey account/building/dues/proposal/vote-change test passed against the final WASM. Allowlisted evidence: `deployments/building-production-testnet-v3.json`. Run `node scripts/verify-building.mjs building-production-testnet-v3.json` to verify it independently.
