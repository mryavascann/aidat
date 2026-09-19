# Duly - three-minute pitch

Six main slides, 235 spoken English words. Allow short pauses and about 10 seconds of screen navigation during the demo. The four appendix slides are for questions, outside the three-minute delivery.

**[Live demo](https://duly-sepia.vercel.app)** · [Deployment manifest](../deployments/building-testnet-v3.json) · [Settled payment](../deployments/building-demo-ux-testnet-v3.json)

## 1. Cover (0:00–0:20)

This is Duly, a shared treasury for apartment buildings. Residents pay dues together. Duly helps them see the money and control how it is spent.

## 2. The Solution (0:20–0:50)

Residents pay dues. The manager sees which apartments still owe money. For an expense, the manager enters the amount in lira. Duly uses the saved manager IBAN and sets the USDC limit. Each apartment has one vote. Residents can approve spending or raise an objection.

## 3. PMF (0:50–1:15)

Our first users are managers of small apartment buildings. Today, payment records and decisions can be hard to follow. We bring them together. Our next step is to test this with real building managers.

## 4. Technical Workflow (1:15–1:45)

Stellar enforces the spending rules. DeFindex holds the USDC reserve. The bank adapter connects this money to the lira payment flow. These parts work together in the product. Today, we use Stellar Testnet, and bank payments are simulated.

## 5. MVP Demo (1:45–2:25)

Here is the working app. We can see the balance, dues and expenses. This completed expense is for one hundred lira. The limit was two point two seven USDC. It spent about two point zero six. The bank simulation confirmed the payment. The receipt and Stellar transaction are public.

## 6. The Team & Next Steps (2:25–3:00)

We built the app, the treasury rules and the payment flow. Next, we need pilot feedback and a regulated banking partner. Security review comes before real funds. Duly gives residents a clear view of shared money and a voice in spending it. Thank you.

## Demonstration

Prepare an existing funded demo before presenting. Show the shared balance, the dues table and a completed expense. Do not depend on a fresh anchor deposit or payout finishing on stage. If the bank is slow, use the recorded 100 TRY payment and its public transaction receipt. Stellar transfers use testnet assets; bank settlement is simulated.

The verified receipt records 100.00 simulated TRY, a 2.27 USDC ceiling and 2.0601077 test USDC spent. Its simulated bank reference is `FAST-NVXJ9O5Y48`. [Transaction](https://stellar.expert/explorer/testnet/tx/8037e829426810484107dc51389a648f030c9f67c522e443ac54995a56a54bb0).

## Questions to prepare for

- **Why Stellar?** The treasury enforces signatures and spending rules. The bank and dues adapters remain trusted.
- **Why DeFindex?** Contributions enter the compatible liquid vault and authorized payouts redeem the shortfall. There is no active yield strategy.
- **Does real bank money move?** No. The workshop anchor simulates bank settlement and performs actual Stellar Testnet transfers.
- **Can a manager bypass the budget?** The chosen policy permits a new recipient or budget exception after three days without objection, or majority approval earlier. Residents must monitor notices. This is not an absolute loss cap.
- **Who receives the payment?** The current MVP pays the manager’s saved IBAN. It does not prove a later payment to a service provider.
- **What traction exists?** Functional evidence exists. Real-user adoption, pilot commitments and pricing are not validated.
- **What comes next?** Proposed manager interviews and a building pilot, a regulated TRY anchor partnership, independent security review and recovery work. Pilot evidence can support SCF/InstAward preparation.

## Submission details still to confirm

Actual team names, roles and the selected track have not been provided for this draft. The team slide lists workstreams without inventing identities. Add verified member information before submission. The handbook emphasizes real fiat rails; acceptance of the workshop’s simulated bank settlement must be confirmed with the event organizers.

The presentation follows the official template’s section order: Cover, The Solution, PMF, Technical Workflow, The Team, with a demo slide added. The visual design uses Duly’s brand and two architectural illustrations created with Higgsfield / Recraft V4.1.
