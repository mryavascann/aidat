# Duly — pitch and submission draft

This copy matches the September 19 testnet implementation. It is not a submitted deck. The official template's five sections are retained below. The public demo is available; team identities and real validation must be supplied before submission; no traction is inferred from automated tests.

## 1. Cover

**Duly**

A shared treasury for communities.

Collect dues. Approve expenses together. Follow every payment.

Stellar Pro Hackathon · Istanbul · September 19–20, 2026 · Genesis track.

## 2. The Solution

A community should be able to see its fund and decide how it is spent.

Duly holds building contributions in a Soroban treasury instead of a manager's personal wallet. Apartment seats are fixed at setup; each apartment has one vote. Residents elect the manager, approve budgets and recipients, and can object to exceptional expenses.

The Turkish/English interface accepts direct Circle testnet USDC or simulated TRY bank payments. It tracks dues in 30-day periods from setup and shows the manager unpaid and partially paid apartments. Contributions enter a DeFindex reserve. A manager creates a TRY expense with the recipient's IBAN; the recipient needs neither a Duly account nor a crypto wallet.

Routine payments to approved recipients within the budget need no further vote. New recipients and budget exceptions wait three days without objection, or can pass earlier with an apartment majority. An objection requires majority approval. This policy is not an absolute budget loss cap.

Demo boundary: bank settlement is simulated, Stellar transfers run on testnet, and the liquid reserve has no active yield strategy. Initial owner identity and legal title still require off-chain verification. The bank/dues adapter is trusted for bank settlement, FX and TRY accounting.

## 3. PMF

Initial audience: apartment communities, housing associations and other groups managing shared expenses. The hypothesis is that a shared balance and recorded approval process can reduce uncertainty around contributions and spending.

This hypothesis still needs validation. No real-user counts, interviews, pilot commitment or financial savings are claimed.

Ask attendees:

1. Can you currently inspect your community's fund balance?
2. How are shared expenses approved and communicated?
3. What would stop you from trying a shared treasury?

Record actual, consented responses and distinguish feedback from committed pilot interest. Replace this research plan with evidence before presenting traction.

## 4. Technical Workflow

1. **Start.** A jury member creates a solo demo with three simulated apartments. Personal accounts use passkey smart accounts or an existing Stellar wallet. Normal setup fixes all seats and owners; the manager cannot add fake voters later.
2. **Contribute and track.** Direct USDC is the default payment option; the solo demo provides one-time test wallet funding. TRY remains available through SEP-10 / SEP-38 / SEP-6. The payer signs a contribution for an apartment and USDC enters the treasury's reserve. Verified receipts carry a fixed TRY credit into the shared dues ledger; payments clear oldest debt first and surplus carries forward.
3. **Announce and pay.** The manager fixes the TRY amount, recipient IBAN hash and USDC ceiling. The contract enforces the approved-recipient budget or the selected objection/majority rule. The bank adapter redeems the required liquidity and sends the anchor's exact-memo payment.
4. **Check the receipt.** The expense distinguishes on-chain disbursement from final simulated bank settlement. A registered queue can continue without the initiating browser. Recipients do not log in.

The existing public V3 round trip verified **200 simulated TRY → 4.0792181 test USDC contribution → 100 TRY IBAN expense**, with simulated bank reference **FAST-J83IBKWCYF**. The separate keeper also settled an expense with the browser closed. Public receipts are in [production evidence](../deployments/building-production-testnet-v3.json). The USDC/dues accounting implementation and evidence are described in [monthly dues](stories/03-monthly-dues.md).

Rust/Soroban SDK 27.0.6; native `require_auth`, persistent seats, versioned votes and events. Apartment owners can transfer seats or delegate voting. Missing-owner recovery requires the other apartments' majority and a seven-day owner veto window. Manager replacement requires apartment majority. Smart accounts use pinned OpenZeppelin account bytecode and a WebAuthn verifier through Smart Account Kit; virtual-authenticator integration is tested, not physical biometric hardware or an independent audit.

The solo demo uses separate WASM with 20-second objections, 60-second ownership recovery and 10-minute billing/budget periods. Normal buildings enforce three days, seven days and 30 days. Simulated votes are visibly labelled.

## 5. The Team

Actual names, roles, contact details and relevant experience have not been supplied. Add the real team to the official template; do not infer identities from GitHub handles, local folders or test accounts.

## Demo narration

“This is Duly, a shared treasury for a building. Here everyone sees the same balance. I start a solo demo, load test USDC and contribute for one apartment. The manager's dues table updates immediately and shows which other apartments still owe money. TRY bank simulation is also available.

Now I create a cleaning expense with the cleaner's IBAN. The cleaner needs no app. A new recipient triggers an objection window; the solo demo accelerates it to 20 seconds. The contract enforces the rule, the queue completes the bank simulation, and the expense shows its receipt.

Each apartment has one fixed vote. Owners can replace the manager or transfer their seat. A personal account can sign with a passkey. This is a testnet demonstration with simulated banking; next we need real community validation, a regulated anchor partner and production security work.”

## Market path, business model and positioning

Material for the deck and for Q&A. These are plans and hypotheses, not validated results; say so when asked.

**Adoption path** after the first communities we onboard:

- **Next: volunteer managers of small buildings (5–30 flats).** They want to escape "you took the money" accusations, and they are the ones who bring the product into the building. Requires a real TRY anchor partner.
- **Scale: professional site management companies.** One agreement covers hundreds of flats and comes with a real budget. Only after a licensed TRY ramp and compliance processes are in place.

**Business model (proposed tiers):**

| Tier | For | What they pay for |
|---|---|---|
| Free | Small communities, up to a member or volume limit | Treasury, approvals and transparent history: the base that lets Duly spread |
| Pro (monthly fee per flat or member) | Managers and management companies | Reminders, reports for the owners' meeting and the auditor, export, multi-building dashboard; packaging of the existing dues tracker remains to be validated |
| Partner revenue | The TRY anchor partner | Every building deposits lira every month, giving the anchor predictable volume; in return, a revenue share |

Basic monthly dues and arrears tracking is now included in the MVP. Reminders, exports, reports and a multi-building dashboard are not built; they remain possible paid roadmap features. Pricing is to be set against the per-flat fees of existing dues apps. No share of reserve yield is offered: the vault has no active strategy, and a yield promise adds regulatory risk.

**Positioning:** "Dues apps show the money; Duly protects it. Crypto treasuries protect the money; Duly makes it usable for everyone."

## Q&A facts

- **Can one administrator take the fund?** Seats are fixed at setup, so the manager cannot add voters. Routine payments are constrained by the majority-approved recipient list and budget. New recipients and exceptions may pass after three days without objection; residents must monitor notices. This is not an absolute loss cap, and initial owner identity still needs verification.
- **Can a manager hand over administration?** Yes. Apartment majority elects or replaces the manager. Seat owners can separately transfer an apartment without manager approval.
- **Does the reserve earn interest?** No. This vault currently holds liquid Circle USDC. It is integrated into every contribution and approved payout; no rate of return is claimed.
- **Must testers install a wallet?** No; the demo creates browser-held test accounts. This is a testnet convenience, not a production custody design.
- **Does real money move through a bank?** No. The workshop anchor simulates bank settlement and performs actual testnet Stellar transfers.
- **Is mainnet a configuration switch?** No. Production requires account security, governance, audited contracts, a production anchor and operational work.
- **What traction exists?** Functional tests exist. Real-user validation has not been recorded.
- **Who is your customer?** Whoever runs the building's money decides; every resident is a user. Next come volunteer managers of small buildings, and at scale professional site management companies, once a licensed TRY ramp is in place.
- **How will you make money?** Free for small communities, a Pro plan per flat or member for managers and management companies, and a revenue share with the TRY anchor partner for the recurring volume we bring. Not validated yet.
- **How are you different from dues apps, or from Safe and Squads?** "Dues apps show the money; Duly protects it. Crypto treasuries protect the money; Duly makes it usable for everyone." Dues apps digitise the records while the money stays in an account one person controls. Crypto treasuries enforce rules but expect wallets and crypto; Duly takes lira in and out through an anchor, speaks Turkish, and Stellar's low fees keep small dues economical.
- **Why would an anchor partner work with you?** Buildings deposit lira every month, which is predictable recurring volume for the anchor; we ask for a revenue share in return.
- **Will you share the reserve's yield?** Not now. The vault has no active strategy, and promising yield adds regulatory risk.

## Submission work remaining

The frontend is published at [duly-sepia.vercel.app](https://duly-sepia.vercel.app), and the repository is public. The implementation is on `main`. Verify the phone/extension-wallet path; confirm sandbox acceptance with mentors; add actual team details; collect real feedback; place verified links and the official deck in the portal with Genesis selected.

The handbook lists September 20, 2026 at 12:00 Istanbul as the submission deadline. No submission or external outreach has been performed.
