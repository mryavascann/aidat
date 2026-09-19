# Duly — pitch and submission draft

This copy matches the September 19 testnet implementation. It is not a submitted deck. The official template's five sections are retained below. Team identities, a public demo URL and real validation must be supplied before submission; no traction is inferred from automated tests.

## 1. Cover

**Duly**

A shared treasury for communities.

Collect dues. Approve expenses together. Follow every payment.

Stellar Pro Hackathon · Istanbul · September 19–20, 2026 · Genesis track.

## 2. The Solution

A community should be able to see its fund and decide how it is spent.

Duly holds community contributions in a Soroban treasury instead of a manager's personal wallet. Members can inspect the balance and record their approvals. Every proposal fixes a payee and amount; payment needs two member signatures in the demonstration.

The Turkish/English interface connects a TRY bank sandbox to Circle testnet USDC. Contributions automatically enter a DeFindex reserve; approved payments redeem the amount they need. The recipient can withdraw through the same sandbox.

Demo boundary: bank settlement is simulated, Stellar transfers run on testnet, and the liquid reserve has no active yield strategy. The administrator controls membership, so quorum does not establish independent human voters.

## 3. PMF

Initial audience: apartment communities, housing associations and other groups managing shared expenses. The hypothesis is that a shared balance and recorded approval process can reduce uncertainty around contributions and spending.

This hypothesis still needs validation. No real-user counts, interviews, pilot commitment or financial savings are claimed.

Ask attendees:

1. Can you currently inspect your community's fund balance?
2. How are shared expenses approved and communicated?
3. What would stop you from trying a shared treasury?

Record actual, consented responses and distinguish feedback from committed pilot interest. Replace this research plan with evidence before presenting traction.

## 4. Technical Workflow

1. **Start or join.** The browser can create an independent demo treasury and three test accounts. An administrator can issue a one-use QR invitation. Existing wallets connect through Stellar Wallets Kit.
2. **Contribute.** SEP-10 authentication → SEP-38 quote → SEP-6 bank simulation → Circle USDC → a member-signed contribution → DeFindex vault shares owned by the treasury.
3. **Approve and pay.** A member proposes the payee and exact amount. A different member approves. `execute` redeems any liquidity shortfall and pays only the approved recipient and amount.
4. **Withdraw.** The payee obtains a quote, sends USDC with the anchor's exact memo, and receives a sandbox bank receipt.

Verified canonical round trip: **TRY 200 → 4.0792181 USDC contribution → 2 USDC approved expense → TRY 97.08 simulated bank payout**. Final reserve backing after including the migrated balance: **4.1584362 USDC**.

[Treasury](https://stellar.expert/explorer/testnet/contract/CC7TIRVPWB4EFE7ZPA3JZZD2VC5ZDRAHFN6UURSGW4JNJISMKGMGTKUR) · [Contribution into reserve](https://stellar.expert/explorer/testnet/tx/e6e70f84c7ca14a5cebaf2fedfa1102ffaf03f314327327333d11af3948e3c5d) · [Automatic redemption and payout](https://stellar.expert/explorer/testnet/tx/7988608557950395fcdbda2010590a7078f2c3f33c134e39c4e1ec66c0ea91f3) · [Withdrawal](https://stellar.expert/explorer/testnet/tx/3787ff7a67b884975a4e869e8f06cf7db8cf25266fa88442f0ed1ef35fc44820).

Rust/Soroban SDK 27.0.6; atomic initialization, signature checks, replay protection and explicit invitation expiry. Contributions and approvals use persistent storage. The vault accepts the verified Circle token, is not upgradable, and has no active strategy. The web checks the treasury's deployed WASM and reserve address before using invitation links.

The browser flow has also been exercised independently, including a reload after the quote and a third account joining through an invitation. Proof is in `deployments/browser-testnet.json`.

## 5. The Team

Actual names, roles, contact details and relevant experience have not been supplied. Add the real team to the official template; do not infer identities from GitHub handles, local folders or test accounts.

## Demo narration

“This is Duly, a shared treasury for communities. Here we can all see the same balance. A resident gets a lira quote and simulates a bank payment. The USDC contribution goes into the community's DeFindex reserve.

Now the resident proposes a maintenance expense. Their signature is the first approval. We switch to a different member and approve it. Only then can the contract redeem the required reserve shares and pay the service provider. The provider withdraws through the bank sandbox, and every Stellar step has a receipt.

This is a testnet demonstration: the bank leg is simulated and no yield strategy is active. Our next work is real community validation, stronger membership governance, and a production anchor partnership.”

## Q&A facts

- **Can one administrator take the fund?** A payout requires the configured member-signature quorum, but the administrator can enroll accounts they control. Stronger membership governance is future work.
- **Can a manager hand over administration?** Not in this contract version. Do not claim this is solved.
- **Does the reserve earn interest?** No. This vault currently holds liquid Circle USDC. It is integrated into every contribution and approved payout; no rate of return is claimed.
- **Must testers install a wallet?** No; the demo creates browser-held test accounts. This is a testnet convenience, not a production custody design.
- **Does real money move through a bank?** No. The workshop anchor simulates bank settlement and performs actual testnet Stellar transfers.
- **Is mainnet a configuration switch?** No. Production requires account security, governance, audited contracts, a production anchor and operational work.
- **What traction exists?** Functional tests exist. Real-user validation has not been recorded.

## Submission work remaining

The frontend is published at [duly-sepia.vercel.app](https://duly-sepia.vercel.app), and the repository is public. The implementation is on `codex/treasury-foundation`. Verify the phone/extension-wallet path; confirm sandbox acceptance with mentors; add actual team details; collect real feedback; place verified links and the official deck in the portal with Genesis selected.

The handbook lists September 20, 2026 at 12:00 Istanbul as the submission deadline. No submission or external outreach has been performed.
