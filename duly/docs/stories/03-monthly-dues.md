# Direct USDC and monthly dues

September 19, 2026. Extends the V3 building product without changing its contracts or moving existing funds. The user chose **30-day periods from setup** for dues, matching the existing budget schedule. The friend's `6bad646` pitch/business-model addition was merged from `codex/treasury-foundation`; the pitch's old technical claims were then aligned with V3.

## Product behavior

- **Contribute USDC** is the default on the existing Pay dues page. **TRY bank payment** remains alongside it. An owner, tenant or other payer chooses the apartment; payment does not change voting rights.
- The solo demo has one-time **Get test USDC** funding. It puts test assets in the demo wallet, not in the treasury or dues ledger. The jury member then signs a contribution. The existing demo remains three simulated apartments controlled by one tester.
- The same page shows all fixed apartments, current owner, paid/partial/unpaid status, paid and remaining amount for a selected period, and total arrears. A filter shows only apartments with known remaining debt. Overpayments are shown as advance credit.
- The configured TRY dues amount accrues once at the beginning of each setup-relative period, including period one. Payments clear the oldest dues first, then future periods. Debt and advance credit belong to the apartment across ownership changes. Historical periods show their current settlement status, not a reconstructed balance as of the period-end date.
- Normal periods are 30 days; the explicitly labelled solo demo uses its contract's 10-minute period. Timestamp and ledger boundaries both apply. Dues amount changes, reminders, penalties, exports and multi-building administration were not added.

## Money and evidence

`contribute` already records the apartment, payer and exact USDC amount in a treasury event. No new financial authorization or contract method was needed. The contract still tracks cumulative apartment contributions in USDC and enforces governance; **TRY debt is a reporting function of the trusted server adapter**, not new Soroban-enforced debt.

`POST /api/dues` provides four actions:

1. `quote`: verifies the deployed building and apartment, reads the testnet anchor's sell rate, and seals a ten-minute quote binding the building, payer, apartment and exact USDC/TRY amounts. Integer arithmetic truncates to TRY cents. This is a reporting conversion, not a promised bank withdrawal price.
2. `record`: verifies a successful RPC receipt with exactly one matching `contribution_recorded` event emitted by that treasury. Apartment, payer and stroops must match. Direct USDC must have settled within its saved quote window. A bank deposit must be completed; its actual gross TRY payment is credited, not a later FX calculation or net USDC value.
3. `ledger`: reads the shared, durable per-building dues records. No browser account is required to inspect this public building accounting.
4. `demo-funds`: resumes one encrypted, persisted funding flow per demo building. Only the demo manager receives the test USDC. A repeated request does not create another completed deposit.

The per-building classic account is deterministically derived from the retained server bank key. One account-data row per contribution stores apartment, TRY cents, USDC stroops, ledger-close timestamp and payment method. A second row claims the quote/bank-order reference. Both rows are written atomically, with source-account sequence checks and bounded retry. No mutable total is incremented. Replaying a receipt returns its existing record; another receipt cannot claim the same payment reference.

The account data is public, signed by the adapter-controlled index account and carries building/bank metadata. This is **not an independent bank-root attestation or trustless FX oracle**. The service is trusted for the conversion and durable index, just as the existing bank adapter is trusted for simulated bank settlement. There are no raw IBANs, private keys or sealed references in the public ledger response. A production service needs operational storage/reserve funding and indexing capacity.

## Recovery and incomplete history

The browser saves the quote and the exact signed contribution authorization before submission. After success, it persists the receipt and `recording-dues` phase before indexing. If indexing fails, resuming retries the same receipt without moving funds again. TRY records follow the same sequence. An expired quote can refresh only when no signed intent exists. Signed or uncertain authorizations retain their original quote for reconciliation; do not discard them and pay again.

The table compares indexed USDC against each apartment's on-chain cumulative contribution. Any mismatch displays **Review needed** with unknown amounts instead of mislabelling the apartment unpaid. A temporary lag between RPC and Horizon can also cause this safe state until refresh. Saved completed TRY payments offer a reconciliation action. Historical direct payments without a saved FX reference cannot be assigned an invented rate.

Stellar RPC has finite transaction retention (normally about seven days). A contribution must be indexed while its receipt is available. Once indexed, the durable record is returned without requiring that old RPC receipt. Older unmatched contributions require separate reconciliation. See the primary [getTransaction documentation](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransaction).

## Verification

Pure model tests cover both clock boundaries, oldest-first allocation, partial and advance payments, ownership changes, frozen TRY credits and unmatched history. Server tests use a real public contribution-event fixture and reject the wrong treasury, apartment, payer, amount, failed transaction, duplicate event, invalid quote window and corrupt ledger row.

`npm --prefix web run test:dues` exercises the actual local/testnet API and browser: one-person funding, direct USDC for two apartments, TRY for a third, receipt replay, reload, a separate browser, unpaid filtering and mobile light/dark accessibility. `--resume` preserves and resumes the same private journal. Browser storage, signed payloads and virtual-authenticator credentials stay ignored under `web/test-results/`; only allowlisted addresses/amounts/receipt hashes may be committed as proof.

The existing passkey test also selects the TRY option explicitly so the new default cannot accidentally change what it is testing. Physical biometric hardware remains untested.

Local testnet verification passed with two direct USDC payments (5 and 1 USDC), one 50 TRY payment, and a separate passkey-authorized 50 TRY contribution in a normal building. Replay left the indexed payment count unchanged; another browser read the same ledger. Model/server tests: 24 passed; shared script tests: 16 passed. TypeScript/Vite build passed. Public addresses and receipts are in [dues evidence](../../deployments/building-dues-testnet-v3.json); `node scripts/verify-dues.mjs` verifies the exact contribution events, apartment totals, deployed code, clocks and durable account-data rows without reading a key or signing.

The same fresh solo USDC/TRY journey also passed on the production HTTPS domain, including receipt replay, cross-browser state, unpaid filtering and mobile light/dark accessibility. The separate 32-page language/theme/viewport suite passed there too. Public evidence includes all seven local/production contribution receipts and the deployment ID.
