# Duly - three-minute pitch and audience demo

Seven main slides, 149 spoken English words and a 45-second silent product video. The introduction takes three minutes including pauses and slide changes. A prepared audience session follows for about two minutes. Four appendix slides support jury questions.

**[English deck with embedded video](../../output/presentation/Duly-Pitch-EN-Problem-Solution-Growth-v7.pptx)** · [Standalone video](../../output/video/Duly-Product-Demo-EN-45s.mp4) · [English script and fallback lines](../../output/presentation/Duly-Speaker-Script-EN-v5.md) · [Turkish rehearsal plan and Q&A](../../output/presentation/Duly-Sunum-Plani-TR-v5.md)

The problem and solution slides answer the same questions: how much remains, who controls spending, and where the payment goes. The acquisition slide presents a planned pilot approach, not existing customers or partnerships.

## 1. Cover (0:00–0:10)

This is Duly, a shared treasury for apartment buildings.

## 2. The Problem (0:10–0:35)

Residents pay dues, but often depend on the manager for answers. How much is left? Who approved the repair? Where did the money go?

## 3. The Solution (0:35–1:00)

Duly puts the balance and spending decisions in one shared treasury. Each apartment has one vote. Residents can approve or object. Stellar checks the rules before funds leave.

## 4. Technical Workflow (1:00–1:15)

The reserve connects to DeFindex. Bank payments use a TRY anchor. This is Testnet, with simulated bank settlement. Let’s see the product.

## 5. Product Demo Video (1:15–2:00)

[Play the 45-second silent product demo. No additional speech is needed.]

## 6. User Acquisition Plan (2:00–2:35)

We will reach volunteer managers through our network and local groups. Each manager invites residents by QR. We guide the first dues cycle, measure repeat use, and ask active managers for referrals. These are planned pilots.

## 7. The Team & Live Demo (2:35–3:00)

We built the app, treasury rules and payment flow. Now let’s run a building together. I will be the manager. You are the residents. Let’s pay test dues and vote.

## Pilot acquisition plan

Start with volunteer managers of small apartment buildings through direct outreach in the team’s network and local resident groups. Help a manager invite residents by building QR and complete a first test dues cycle and repair vote. Measure participation in the next dues cycle, then ask active managers to introduce another building. These are planned Testnet pilots. Real payments require an appropriate bank/anchor partner, legal review and independent security work.

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

If a device fails, use a rehearsed backup device. If using the single-user solo mode instead, identify its votes as simulated. Preserve pending or failed states. Do not replace an existing payment intent just to make the screen look complete. If bank confirmation is slow, finish on the recorded votes and shared balance. The recorded product demo on slide 5 is a separate solo session and can be replayed if needed. Its bank settlement and other apartment votes are simulated; waiting times were removed.

The video records a 100 TRY test expense with a 2.27 USDC ceiling and simulated bank reference `FAST-MTHN5NPR0A`. [Recorded demo transaction](https://stellar.expert/explorer/testnet/tx/b7cecf6c5c7d3a2e0be1bb20ce3fd9735d54482da4ef01cf4431d3cabfe3c285). The older verified payment linked from the README remains separate evidence.

## Questions to prepare for

- **Why Stellar?** The treasury enforces signatures and spending rules. The bank and dues adapters remain trusted.
- **Why DeFindex?** Contributions enter the compatible liquid vault and authorized payouts redeem the shortfall. There is no active yield strategy.
- **Does real bank money move?** No. The workshop anchor simulates bank settlement and performs actual Stellar Testnet transfers.
- **Can a manager bypass the budget?** The policy permits a new recipient or budget exception after three days without objection, or majority approval earlier. Residents must monitor notices. The budget is not an absolute loss cap.
- **Who receives the payment?** The current MVP pays the manager’s saved IBAN. It does not prove a later payment to a service provider.
- **Are audience votes real?** In the planned normal building, each participant signs their own testnet vote. The solo demo is a separate simulation.
- **How will you acquire users?** Reach volunteer managers through the team’s network and local resident groups, guide the first test dues cycle, measure repeat participation, then test manager referrals. No existing pilot or customer is claimed.
- **What comes next?** Building pilots, a regulated TRY anchor partnership, independent security review and recovery work.

## Submission details still to confirm

Actual team names, roles and the selected track have not been provided. The audience accounts, chosen shared building and physical devices still need preparation and rehearsal. The handbook emphasizes real fiat rails, so confirm acceptance of the workshop’s simulated bank settlement with the organizers.

The deck includes the problem, solution, technical workflow, recorded product demo, pilot acquisition plan and audience participation closing. The illustrations were created with Higgsfield / Recraft V4.1. The video uses actual website footage edited with Higgsedit.
