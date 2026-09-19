# Aidat — pitch and submission copy

Working draft of the English copy for the official pitch template and the Rise In submission portal.
It describes the product as designed. Before submitting, fill in every `[bracket]` and make sure each claim matches what is actually deployed on testnet (see the checklist at the end). Never ship a number or a "live on testnet" claim we have not verified.

## Basics

| | |
|---|---|
| Project | Aidat (Turkish for "dues") |
| Tagline | A shared treasury nobody can empty alone. |
| One-sentence pitch | Aidat moves a building's dues fund out of one person's bank account and into a Stellar smart contract: residents pay in Turkish lira, everyone sees the balance, and every expense needs the members' approval. |
| Track | Genesis — tick it in the portal; projects are only judged in the tracks selected at submission. |
| Team | [team name] · [full name and contact details of every member] |
| Links | GitHub [url] · Live demo [url] · Deck [url] |

## Portal: The Narrative "Why"

**What are you building?**
Aidat is a transparent shared treasury for apartment buildings, housing estates and associations. Residents pay their dues from their bank in Turkish lira; a TRY anchor on Stellar converts the payment to USDC, and it goes straight into a Soroban treasury contract instead of anyone's personal account. Everyone can see the balance. Every expense is proposed, approved by a quorum of members and paid directly to the payee, who withdraws it as lira to their own bank account.

**What problem does it solve?**
Today a building's dues fund usually sits in a bank account controlled by one person, often the manager's personal account. Residents can't see the balance, spending isn't audited, and when the manager changes, the account and its history often go with them. Meanwhile the idle fund loses value to inflation.

**Who are your target users?**
Residents and managers of apartment buildings and housing estates in Türkiye — people who have never used crypto and shouldn't have to. Next come associations, cooperatives, school parent associations and any group that keeps a shared kitty. On the other side are the payees (elevator maintenance, cleaning, repairs), who simply receive lira.

**Why is this problem worth solving?**
Almost every household in an apartment building pays dues every month, yet most residents have no way to check where the money is [back this with the room survey result]. When nobody can check the fund, every expense turns into an argument, residents stop paying, and even an honest manager has no easy way to prove anything. Transparency protects the manager as much as the residents.

**What is your value proposition?**
Pay dues in lira, let everyone see the fund, and decide on spending together. The rules are enforced by code, not by trust in one person: without the members' approval no money leaves the treasury, and the record can't be edited afterwards. Residents see ₺ amounts and bank transfers, never addresses or crypto jargon.

## Pitch deck (official template)

Make a copy of the official template, keep its five slides in their order and add extra slides after them. The template's cover still shows an older event date ("June 2–3"); change it to September 19–20, 2026.

### 1. Cover

- **Aidat** — a shared treasury nobody can empty alone
- Stellar Pro Hackathon · Istanbul · September 19–20, 2026 · Genesis Track
- [team name]

### 2. The Solution

**Pay dues in lira. Everyone sees the fund. Spending needs the members.**

- Residents pay from their bank in lira; a TRY anchor turns it into USDC that lands in a Soroban treasury contract, not in anyone's personal account.
- The balance and every payment are visible to all members, with a quiet "view on chain" link for anyone who wants proof.
- Every expense is proposed, approved by a quorum of members, then paid straight to the payee, who cashes out in lira.

**Think — why is this the best way to fix it?** Building-management apps digitise the bookkeeping, but the money still sits in an account one person controls, and the rules exist only on paper. In Aidat the rule is the code: no quorum, no payment. The lira rail is built in at both ends, so nobody has to touch crypto.

### 3. PMF

- The dues fund sits in an account one person controls. Residents can't see it, spending isn't audited, and a change of manager can take the account and its history with it.
- While it waits, the fund loses value: [VERIFY: the lira's loss against the dollar over the last 12 months, with source]. Today's USD/TRY mid rate from the anchor's Reflector feed: 48.78 (2026-09-19).
- Who is affected: [VERIFY: number or share of households living in apartment buildings in Türkiye, with source, e.g. TurkStat (TÜİK)].
- Story: [a real dues story from a team member's building — what happened and what it cost].
- Validation at the event: [N] people asked · [x] can't see their building's balance · [y] had a dues dispute in the last year · [z] would switch.

**Think — why should anyone care?** When nobody can see the fund, every expense becomes an argument between neighbours, and an honest manager has no way to prove anything.

### 4. Technical Workflow

1. **Join** — the manager shares a QR invite; a resident joins from their phone with a browser key or their own wallet through Stellar Wallets Kit (Freighter, xBull, LOBSTR, Albedo).
2. **Pay dues** — lira → USDC through a TRY anchor (SEP-10 auth, SEP-38 quote, SEP-6 deposit), then `contribute` into the treasury contract.
3. **Spend** — `propose` (payee, amount, description) → members `approve` → at quorum, `execute` sends USDC straight to the payee.
4. **Cash out** — the payee withdraws USDC → lira to their IBAN through the same anchor (SEP-6 withdraw).
5. **Idle fund** [ONLY IF SHIPPED — this is our load-bearing eligible integration] — idle USDC sits in a DeFindex vault and earns yield; `execute` pulls it back automatically when the cash balance is short.

Under the hood: a Soroban contract in Rust (soroban-sdk 27) with `require_auth` on every member action. Instance storage keeps the config, member list and proposal counter; persistent storage keeps contributions, proposals and approvals, with the TTL extended on access; temporary storage keeps invite codes and payout intents, which expire on their own. Circle USDC on testnet, the TRY anchor (SEP-6/10/12/38), [DeFindex vault], Stellar SDK, Stellar Wallets Kit.

On testnet: contract [contract ID] · deposit [tx] · execute [tx] · withdraw [tx]

**Think — how does it work, and why will it succeed?** Residents keep their habit: they still pay from their bank in lira. Crypto stays out of sight — amounts in ₺, no addresses. Each action settles in about five seconds for [measured fee from our testnet transactions], and the anchor gives a lira rail at both ends.

### 5. The Team

- [Name] — [role]. [At most 3 lines: relevant skills and what they built here.]
- [Name] — [role]. [...]
- [small team photo]

**Think — why are you the right people?** [e.g. we live in these buildings, one of us has managed a building's dues, what we have built before]

### Extra slides (after the template)

6. **Live demo** — [app URL] and a QR code. Flow to show: join → pay dues → propose → approve → pay → cash out.
7. **Traction** — [N] people surveyed, [M] joined a treasury on testnet during the event, [K] dues payments; one or two quotes.
8. **Roadmap and next step**
   - Pilot with [a real building] after the event.
   - Passkey smart wallets for one-tap onboarding; handing over the admin role on chain [drop this if `set_admin` ships]. [Only if the DeFindex vault did not ship: list it here instead of on slide 4.]
   - Mainnet with a production TRY anchor — in code, only the network passphrase and the anchor's home domain change.
   - Apply to SCF / InstaAward.
   - Business model: [team to decide — e.g. a small monthly fee per flat, or a share of the yield on the idle fund].

## Q&A prep (mentors and jury)

**Why a blockchain — isn't a shared bank account plus an app enough?**
A bank account has one signatory, and an app can only show what that person reports. The contract enforces the rule itself: without a quorum no money moves, and the history can't be rewritten.

**What happens when the manager changes?**
The fund never leaves the contract, so nothing is lost. [TODO before saying this on stage: handing over the admin role needs a `set_admin`-style function, which the current contract design doesn't have.]

**Isn't holding USDC a currency risk?**
Yes — it is exposure to USD/TRY, and we say so plainly. For a fund whose costs are in lira, a dollar stablecoin has so far protected value rather than eroded it, because the lira has long been weakening. Expenses are still paid out in lira at the anchor's rate.

**Do residents need a crypto wallet?**
No. The quick start creates a key in the browser; anyone who already has a wallet can connect it through Stellar Wallets Kit. Amounts are shown in ₺.

**Who does KYC, and who holds the money?**
KYC and the bank connection sit with the anchor (SEP-12). Aidat is non-custodial: the contract holds the fund and moves it only as the members' approvals allow — no company or person can move it alone.

**Why Stellar?**
Native USDC, anchors that connect the lira through standard SEPs, low fees ([measured fee]), finality in about five seconds, and Soroban for the approval rules.

**What's the business model?**
[team to decide — see slide 8]

**What's next after the hackathon?**
A pilot building, an SCF / InstaAward application, then mainnet with a production TRY anchor.

## Room survey (for traction)

Ask 10–15 people at the event and log the answers (counts plus one-line quotes):

1. Can you see your building's dues balance right now?
2. Has there been a dispute about dues or spending in your building in the last year?
3. Would you switch to a fund where everyone sees the balance and members approve every expense?

## 60-second pitch (spoken)

Every month, millions of people in Türkiye pay their apartment dues into a bank account that one person controls. Nobody else can see the balance, nobody approves the spending, and when the manager changes, the account and its history can go with them — while the money quietly loses value to inflation.

Aidat is a shared treasury nobody can empty alone. You still pay in lira from your bank. A Turkish lira anchor on Stellar turns it into USDC, and it goes into a smart contract, not into anyone's pocket. Everyone sees the balance. Every expense is proposed, approved by the members and paid straight to the elevator company, which receives lira in its bank account.

No wallets to install, no crypto words — just a fund everyone can see.

## Before submission

- [ ] Every `[bracket]` in this file is filled in or removed.
- [ ] The three handbook requirements hold: an eligible integration, a lira anchor flow, and an integration that is load-bearing (see `docs/agent-notes.md`).
- [ ] Contract ID, deployed artifacts and proof transactions (deposit, execute, withdraw) are in the README and on slide 4.
- [ ] The GitHub repo is public (it starts private) and contains no secrets.
- [ ] The live demo URL is public and works from a phone.
- [ ] The README covers the architecture (Mermaid), components, integrations, design decisions and trade-offs, challenges and how we solved them, and setup and test instructions.
- [ ] The README cites the Stellar Skill files we actually used, by path — e.g. `SKILL.md` in CheesecakeLabs/stellar-anchor-skill, `skills/standards/SKILL.md` in stellar/stellar-dev-skill, `defindex-sdk-skill.md` in paltalabs/defindex-sdk.
- [ ] Portal: team name, full names and contacts of all members, GitHub / demo / deployment links, deck link, Genesis track ticked.
- [ ] Deadline: September 20, 12:00.
