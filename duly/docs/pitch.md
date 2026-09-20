# Duly - three-minute pitch and audience demo

Six main slides, 220 spoken English words. Deliver the introduction in three minutes, then allow about two minutes for a prepared audience demo. The four appendix slides are for questions. Accounts, apartment assignments and test funds must be ready before the talk.

**[Live demo](https://duly-sepia.vercel.app)** · [Deployment manifest](../deployments/building-testnet-v3.json) · [Settled payment](../deployments/building-demo-ux-testnet-v3.json)

## 1. Cover (0:00-0:20)

This is Duly, a shared treasury for apartment buildings. Residents pay dues together. Duly helps them see the money and control how it is spent.

## 2. The Solution (0:20-0:50)

Residents pay dues. The manager sees which apartments still owe money. For an expense, the manager enters the amount in lira. Duly uses the saved manager IBAN and sets the USDC limit. Each apartment has one vote. Residents can approve spending or raise an objection.

## 3. PMF (0:50-1:20)

Imagine a shared repair in your building. The manager proposes the expense. Each apartment has one vote. A majority can approve it early. Residents can also object. Everyone can follow the balance and the payment status.

## 4. Technical Workflow (1:20-1:50)

Stellar enforces the spending rules. DeFindex holds the USDC reserve. The bank adapter connects this money to the lira payment flow. These parts work together in the product. Today, we use Stellar Testnet, and bank payments are simulated.

## 5. Working MVP (1:50-2:20)

This completed test payment is for one hundred lira. The limit was two point two seven USDC. It spent about two point zero six. The bank simulation confirmed the payment. The receipt and Stellar transaction are public.

## 6. The Team & Live Demo (2:20-3:00)

We built the app, the treasury rules and the payment flow. Now let’s run a building together. I will be the manager. You are the residents. Please pay your test dues. Then we will vote on a shared repair.

## Live audience session (3:00-5:00)

The presenter acts as manager and owns apartment 1. Two volunteers each use their own account as owners of apartments 2 and 3 in the same normal Stellar Testnet building. Others can follow the shared building. This is a planned session, not a claim that audience participation has already taken place.

| Time | Action | Presenter cue |
| --- | --- | --- |
| 3:00-3:20 | Open the actual building QR from **Share building**. Volunteers open the same building with their prepared accounts. | Open our building. You are the residents. |
| 3:20-3:50 | Volunteers contribute test USDC to their own apartment. Show the balance and dues ledger. | Please pay your test dues. Watch the shared balance. |
| 3:50-4:15 | The manager proposes a 100 TRY shared repair using the saved demo IBAN. | I propose one hundred lira for a shared repair. |
| 4:15-4:45 | Volunteers choose **Yes** or **Object** on their devices. | Would you approve this repair? Please vote on your phone. |
| 4:45-5:00 | Show the vote tally and current payment status. | Here is the result. You helped decide how the money is used. |

Two of three apartments form a majority. If someone objects and there is no majority, show that the expense remains waiting. A majority can authorize early execution. Bank settlement may still be pending. The demo does not depend on final bank confirmation arriving within the two-minute slot.

Closing: **You paid together. You made the decision together. This is Duly.**

## Preparation

1. Create or sign in to the presenter and volunteer accounts on the actual devices before the talk. Rehearse the signing prompts.
2. Create one normal testnet building with those three distinct owner addresses and the presenter as manager. Seats are fixed at setup. A QR link or a dues payment does not grant a vote.
3. Prepare test USDC in each volunteer account. For example, each can contribute 3 test USDC during the demo. If using the TRY bank simulation to fund accounts, finish that confirmation in advance. The **Get test USDC** shortcut is specific to the solo demo account.
4. Use a labelled demo IBAN and a fresh building with an unapproved recipient for the demonstration expense, so the audience can show majority approval before the normal notice period. Check that treasury contributions cover the automatically calculated USDC ceiling.
5. Keep the exact building link and its QR ready. Confirm both volunteers can see their apartment and voting controls.
6. Rehearse the complete flow. Do not include account creation, owner assignment, wallet funding or recovery in the two-minute audience segment.

## Fallback

If a device fails, use a rehearsed backup device. If using the single-user solo mode instead, identify its votes as simulated. Preserve pending or failed states. Do not replace an existing payment intent just to make the screen look complete. If bank confirmation is slow, finish on the recorded votes and shared balance. The earlier completed payment on slide 5 remains separate supporting evidence.

The verified receipt records 100.00 simulated TRY, a 2.27 USDC ceiling and 2.0601077 test USDC spent. Its simulated bank reference is `FAST-NVXJ9O5Y48`. [Transaction](https://stellar.expert/explorer/testnet/tx/8037e829426810484107dc51389a648f030c9f67c522e443ac54995a56a54bb0).

## Questions to prepare for

- **Why Stellar?** The treasury enforces signatures and spending rules. The bank and dues adapters remain trusted.
- **Why DeFindex?** Contributions enter the compatible liquid vault and authorized payouts redeem the shortfall. There is no active yield strategy.
- **Does real bank money move?** No. The workshop anchor simulates bank settlement and performs actual Stellar Testnet transfers.
- **Can a manager bypass the budget?** The policy permits a new recipient or budget exception after three days without objection, or majority approval earlier. Residents must monitor notices. The budget is not an absolute loss cap.
- **Who receives the payment?** The current MVP pays the manager’s saved IBAN. It does not prove a later payment to a service provider.
- **Are audience votes real?** In the planned normal building, each participant signs their own testnet vote. The solo demo is a separate simulation.
- **What comes next?** Building pilots, a regulated TRY anchor partnership, independent security review and recovery work.

## Submission details still to confirm

Actual team names, roles and the selected track have not been provided. The audience accounts, chosen shared building and physical devices still need preparation and rehearsal. The handbook emphasizes real fiat rails, so confirm acceptance of the workshop’s simulated bank settlement with the organizers.

The deck retains the product, solution, PMF and technical workflow sections, with a completed payment proof and an audience participation closing. The illustrations were created with Higgsfield / Recraft V4.1.
