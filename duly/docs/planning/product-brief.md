---
title: Duly product brief
status: implementation-baseline
updated: 2026-09-19
---

# Duly

**Good things, together.** A shared treasury where communities contribute, approve expenses and follow the same payment record.

## Problem and audience

Community money passes through several disconnected steps: collection, a balance check, a spending decision and payment to a provider. Duly makes those steps visible in one place. The current demo focuses on building communities using TRY bank transfers; the Duly brand and English/Turkish interface support a broader audience.

The administrator invites members and manages the community. Members contribute and vote. Service providers receive approved USDC payments and can use the bank sandbox to withdraw. A visitor can inspect the public treasury before connecting a wallet.

These roles come from the existing implementation and handoff, not customer interviews. Demand, willingness to pay, preferred payment frequency and international fiat corridors remain hypotheses. No user count, revenue, yield or real-bank adoption is claimed.

## Core experience

1. Open a treasury and understand its balance without signing in.
2. Connect a member wallet or create an independent test community.
3. Obtain a quote, complete the sandbox bank transfer and place the contribution in the reserve.
4. Propose a fixed expense, collect distinct member approvals and pay the approved recipient.
5. Let the recipient withdraw; expose receipts and recovery actions throughout.

The overview's next action depends on the current account. An unfinished order takes priority. Members can see approvals needing attention. A provider with a wallet balance can withdraw. Viewing a completed payment should never start another transfer.

## Why Stellar fits this implementation

Soroban enforces fixed recipients, amounts and approval thresholds. Circle USDC gives the treasury and the anchor a common asset. DeFindex holds treasury-owned reserve shares and releases backing when an approved expense is paid. The workshop anchor connects the bank simulation to real Stellar testnet operations.

The deployed reserve has no active yield strategy. TRY balance values are estimates; only a confirmed quote determines a bank transfer's amounts.

## Scope and success

This iteration succeeds when a reviewer can follow the contribution → approval → payout journey, understand the next action for each role, and recover the same saved payment after reloading. Success is demonstrated by automated checks and testnet receipts, not by inferred product traction.

The user fixed the MVP scope on September 19, 2026: **collect contributions → approve together → follow the payment**. Existing overview guidance, scoped history, status checks and recovery serve that single journey. Light/dark mode is a usability improvement to these screens, not a new product module.

No further feature expansion is part of this release. Periodic billing, late fees, additional administration panels, multiple fiat corridors, identity verification, account recovery and live yield are deferred. Mainnet and real banking require separate product decisions. Remaining MVP work is delivery and validation of the working flow.

## Source and planning links

The user selected Duly and requested adaptation to [stellar-build](https://github.com/kaankacar/stellar-build/tree/40396f0946461b955091b15f0af9714d3a3ac8ae). Its planning sequence informed these original project artifacts. See [requirements](prd.md), [UX](ux-design-specification.md), [architecture](architecture.md) and [epics](epics.md).
