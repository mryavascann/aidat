# Pro Hackathon 2026 — Tracks & Handbook

> Source: the organizers' handbook (Rise In × Stellar), received as a DOCX on 2026-09-19 and converted to Markdown.
> The judging-portal screenshot in the original is left out on purpose because it shows other participants' contact details,
> and the original DOCX is not committed for the same reason.

Dates: September 19–20, 2026  
Venue: Grand Pera, Beyoğlu, Istanbul  
Organized by: Rise In x Stellar  

## Overview
The Pro Hackathon runs two parallel tracks, open to different builder profiles and judged against different bars.

|  | Genesis Track | Scale Track |
|---|---|---|
| Who it's for | Open applicants, experienced developers chasing a new features | Residency graduates + invited teams with proven Stellar experience + InstAward/SCF grantee |
| What they build | A net-new product, built from scratch and shipped with a real Stellar integration (core feature or anchor) | An integration or composition on top of existing Stellar ecosystem protocols (core feature or anchor).  Last day is the Lounge Day for Scale Track participants. They will present the products in front of SDF team, invited investor/VCs/founders. |
| Entry | Open application | Invite-only |
| Bar | A working prototype: meets the Genesis and Scale Track Requirements, deployed on testnet. | Same technical bar as Genesis. The difference is eligibility-plus two extra deliverables: an architecture diagram and a post-hackathon roadmap toward SCF/InstAward. |

## Agenda
Day 1

| 09.00-10.00 | Registration to the Pro Hackathon |
|---|---|
| 10.15-10.30 | Welcome & Opening Remarks by the Stellar Team |
| 10.30-11.00 | Hackathon Briefing & Judging Overview |
| 11.00-11.30 | Workshop: Anchor Integration |
| 13.30-15.00 | Lunch |
| 15.00-16.00 | Idea validation with the mentors + office hours Team formation mixer |
| 16.00-18.30 | Hacking time & Mentor Office Hours |
| 18.30-19.30 | Dinner |
| 19.30→ Overnight | Open hacking session |

Day 2

| 10.00-12.00 | Hacking time + office hours |
|---|---|
| 12.00 | Project Submission Deadline |
| 12.00-13.00 | Lunch |
| 13.00-14.30 | Demo Day (Genesis Track) - Genesis jury only |
| 14.30-15.00 | Genesis Track Winners Decision |
| 13.00-16.00 | Lounge Day (Residency + Scale Track) -  including Scale Track jury, decision, investor/VC audience invited network session |
| 16.00-16.30 | Closing Ceremony + Awards |

## Genesis and Scale Track Requirements
Both tracks are judged against the same three requirements.
- Integration: build on an existing Stellar protocol from the Eligible Integration Partners list below.
- Anchor / Local Payments:  give the product a real fiat rail using an anchor or another anchor from the list. Concretely: a user should be able to put real Turkish lira in and get a usable balance out, or the reverse.
- Core Feature: the integration is load-bearing, part of what the product does.
At the end of the event, the metrics tracked are: how many teams shipped a core feature integration, how many shipped an anchor integration, how many captured real traction, and how many onboarded real users.

#### Eligible Integration Partners
Curated from the official[ ](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/integration-track/integration-list)[SCF Integration List](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/integration-track/integration-list), filtered for integrations realistically doable in a 2-day hackathon window. Teams are not limited to this list; any protocol from the full SCF Integration List qualifies.

| Category | Protocol | What it does | Resources |
|---|---|---|---|
| DeFi - Yield | [DeFindex](http://defindex) | Yield infrastructure / vault aggregator for wallets & apps | [Docs](https://docs.defindex.io/) ·[ ](https://docs.defindex.io/api-and-sdks-integration-guide/quickstart)[Quickstart](https://docs.defindex.io/api-and-sdks-integration-guide/quickstart) ·[ ](https://api.defindex.io/docs)[API Reference](https://api.defindex.io/docs) ·[ ](https://discord.com/invite/yXFaku4w9u)[Discord](https://discord.com/invite/yXFaku4w9u) |
| DeFi - Lending | [Blend v2](https://www.blend.capital/) | Lending pool protocol | [Docs](https://docs.blend.capital/) ·[ ](https://discord.com/invite/a6CDBQQcjW)[Discord](https://discord.com/invite/a6CDBQQcjW) |
| DeFi - DEX/Swap | [Aquarius](https://aqua.network/) | Liquidity & swap routing across Stellar DEX markets | [Docs](https://docs.aqua.network/) ·[ ](https://discord.gg/sgzFscHp4C)[Discord](https://discord.gg/sgzFscHp4C) |
| DeFi - DEX/Swap | [Soroswap](https://soroswap.finance/) | Routing API aggregating Soroban + classic liquidity | [Docs](https://docs.soroswap.finance/) ·[ ](https://api.soroswap.finance/docs)[API Reference](https://api.soroswap.finance/docs) ·[ ](https://discord.com/invite/yXFaku4w9u)[Discord](https://discord.com/invite/yXFaku4w9u) |
| DeFi - DEX/Swap | [Stellar Broker](https://stellar.broker/) | Multi-source liquidity swap router | [Docs](https://github.com/stellar-broker/client) |
| Cross-chain | [Circle CCTP](https://www.circle.com/) | Native 1:1 USDC transfer across chains | [Docs](https://developers.circle.com/cctp) ·[ ](https://github.com/circlefin/circle-cctp-crosschain-transfer)[Sample app](https://github.com/circlefin/circle-cctp-crosschain-transfer) ·[ ](https://discord.gg/buildoncircle)[Discord](https://discord.gg/buildoncircle) |
| Cross-chain | [Near Intents](https://docs.near.org/chain-abstraction/intents/overview) | Multi-chain execution / intent routing | [1Click API](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api) ·[ ](https://github.com/near-examples/near-intents-examples)[Examples](https://github.com/near-examples/near-intents-examples) |
| Cross-chain | [Allbridge](https://allbridge.io/) | Native stablecoin bridging, EVM ↔ non-EVM | [Docs](https://docs-core.allbridge.io/sdk/get-started) ·[ ](https://discord.com/invite/ASuPY8d3E6)[Discord](https://discord.com/invite/ASuPY8d3E6) |
| Wallets | [Stellar Wallets Kit](https://stellarwalletskit.dev/) | Toolkit to connect Stellar-compatible wallets | [Docs](https://stellarwalletskit.dev/installation.html) ·[ ](https://github.com/Creit-Tech/Stellar-Wallets-Kit)[Repo](https://github.com/Creit-Tech/Stellar-Wallets-Kit) ·[ ](https://discord.gg/khrempQvD5)[Discord](https://discord.gg/khrempQvD5) |
| Wallets | [Privy](https://www.privy.io/) | Embedded email/social-based wallet onboarding | [Docs](https://docs.privy.io) ·[ ](https://privy.io/slack)[Dev Slack](https://privy.io/slack) |
| Wallets | [DFNS](https://www.dfns.co/) | Wallets-as-a-Service (WaaS) | [Docs](https://docs.dfns.co/) ·[ ](https://portal.support.dfns.co/servicedesk/customer/portals)[Help Center](https://portal.support.dfns.co/servicedesk/customer/portals) |
| On/Off-ramp | [Bridge](http://www.bridge.xyz/) | Multi-currency payments/treasury settlement | [Docs](https://apidocs.bridge.xyz/get-started/introduction/overview) ·[ ](https://support.bridge.xyz/)[Support](https://support.bridge.xyz/) |
| On/Off-ramp | [BlindPay](http://blindpay) | Global payments, fiat + stablecoin | [Docs](https://www.blindpay.com/docs/getting-started/overview) ·[ ](https://api.blindpay.com/reference)[API Reference](https://api.blindpay.com/reference) ·[ ](https://discord.com/channels/1260668171204169850/1260668171204169853)[Discord](https://discord.com/channels/1260668171204169850/1260668171204169853) |

#### Official Stellar Skills
These are official skill files from[ ](https://skills.stellar.org/)[skills.stellar.org](https://skills.stellar.org/):
- [Anchors](https://github.com/CheesecakeLabs/stellar-anchor-skill/blob/main/SKILL.md): how to integrate with or build a Stellar anchor: fiat on/off-ramps, deposits/withdrawals, KYC, core SEP flows (1/6/10/12/24/31/38). The direct technical reference for anyone doing the anchor integration.
- [Stellar Integration Finder](https://github.com/lumenloop/lumenloop-skills/blob/main/skills/stellar-integration-finder/SKILL.md): finds the right existing Stellar project to integrate with (wallet, oracle, anchor, DEX, indexer) and routes to the matching build skill. Useful for teams still deciding what to integrate.
- [SEPs, CAPs & Ecosystem](https://github.com/stellar/stellar-dev-skill/blob/main/skills/standards/SKILL.md): picks the right SEP or CAP for a given feature.
- [DeFindex SDK](https://github.com/paltalabs/defindex-sdk/blob/main/defindex-sdk-skill.md) and[ ](https://github.com/soroswap/sdk/blob/main/soroswap-sdk-skill.md)[Soroswap SDK](https://github.com/soroswap/sdk/blob/main/soroswap-sdk-skill.md): official integration skills for two of the protocols in the table above.
- [SCF Submission Radar](https://github.com/lumenloop/lumenloop-skills/blob/main/skills/scf-submission-radar/SKILL.md) and[ ](https://stellarlight.xyz/skills/stellar-scout.md)[Stellar Scout](https://stellarlight.xyz/skills/stellar-scout.md): for teams planning to apply to SCF/InstAward post-event; positions an idea against prior submissions and drafts pitches.
Submission requirement: teams should cite which specific skill file(s) (by path, e.g. skills/standards/SKILL.md) they used during development.

Prize Distribution
Total prize pool: $15,000
Each track will be evaluated independently based on its own criteria, project maturity, execution quality, and overall potential.

| Track | Genesis Track | Scale Track |
|---|---|---|
| 1st | $3000 | $3,500 |
| 2nd | $2000 | $2,500 |
| 3rd | $1,500 | $1,500 |
| 4th | $1000 | - |

### Genesis Track
Track Detail
Genesis Track is open build: pick a problem, form or bring a team, and ship a working Stellar product from zero in two days. Every project still meets the Genesis and Scale Track Requirements above, including a real integration.
What actually separates Genesis from Scale is the motivation: Genesis teams are competing for the $7,500 prize pool.

Eligibility
- Open to any team
- Teams may form on-site or arrive pre-formed
- Teams of up to 4 people

### Scale Track
Track Detail
Scale Track is invite-only, for teams past the first-prototype stage. Teams compose on top of what the Stellar ecosystem already has: a lending protocol, a DEX, an oracle, a vault aggregator, or an anchor for real fiat rails and ship something that makes that infrastructure more useful.
Scale teams are competing for the $7,500 prize pool and are building toward SCF and InstAward funding post-event.
The motivation is different: teams are building toward SCF and InstAward funding, Lounge Day with the SDF team members and the post-event application push exist to get strong teams into that pipeline.
#### Eligibility
- Stellar Residency graduates are automatically eligible
- External applicants: at least one team member must show proven smart contract / Soroban experience (GitHub history, prior project, hackathon track record)
- The team should briefly state which Stellar protocol they plan to integrate with and why it creates ecosystem value. Come up with a qualified idea.
- Team member number depends on the scope

#### Genesis & Scale Track Flow

| Stage | What happens |
|---|---|
| Integration | Teams build the real integration with their chosen protocol and a real fiat rail via an anchor and add a core feature to the product. |
| Testing | Integration gets tested, edge cases and bugs get fixed, contract gets verified on testnet |
| User onboarding & marketing growth | Teams with a live product can onboard real users during this window. With an existing product, teams try to get new users onboarded during the hackathon itself. |
| Reviews | Submission, mentor feedback, and final jury review |
| Demo Day | Presenting to the Genesis Track jury |
| Lounge Day | Presenting to the Scale Track jury and invited investors/VCs |

## Judging & Submission Criteria

Judging Process
Project Submission: All teams participating in both the Genesis and Scale Tracks are expected to submit their projects before the submission deadline in accordance with the hackathon requirements.
Finalist Selection: Once submissions are closed, all projects will be evaluated based on the official hackathon judging criteria. Finalist teams from each track will then be announced.
Final Jury Presentations: Only the finalist teams will present their projects live to the jury.

Judging Criteria

1. Meaningful Idea & Real-World Impact
Evaluate whether the project solves a meaningful problem with genuine adoption potential.
How clearly is the problem defined?
Does it address a real-world use case such as payments, DeFi, RWAs, identity, remittances, or agentic commerce?
Who benefits if the product succeeds, and how significant could that impact be?
Is there a clearly identified target user or customer segment that suggests market viability?
2. Technical Implementation
Assess the quality, completeness, and reliability of the technical execution.
The application is deployed on Stellar Testnet with real functionality—not mocked or hardcoded.
Core user flows work end to end without breaking.
Soroban authentication and storage patterns are implemented appropriately.
The architecture is well designed and documented.
Scale Track only: the submission includes an accurate Mermaid architecture diagram.
Passkeys and smart wallets are treated as bonus features, not requirements.
3. Ecosystem Fit
Measure how meaningfully the project leverages the Stellar ecosystem.
Integrates an eligible Stellar protocol or ecosystem partner.
The integration is fundamental to the product rather than an add-on.
Implements a genuine Anchor or local payments flow (e.g. TRY ↔ Stellar assets via SEP standards).
Makes effective use of Stellar SDKs, CLI, and Skills resources.
References the relevant Stellar Skills within the documentation.
Note: Anchor and local payment integrations carry the highest weight within this category.
4. User Experience
Evaluate usability, accessibility, and overall product quality.
The interface feels intuitive, even for someone new to crypto.
Key features are easy to discover and clearly demonstrated.
Navigation is consistent and the product feels polished and complete.
5. Traction & Continuity
Consider whether the project has realistic momentum beyond the hackathon.
The team gathered feedback or validated the idea with real users during the event.
A credible roadmap exists for continued development.
The submission identifies its intended next step (SCF, InstaAwards, or another path).
The team's skills and execution suggest they can realistically continue building.
6. Presentation & Documentation
Judge how effectively the team communicates both the product and the technology.
The demo and README explain the project clearly.
Judges can easily understand the user flow and system architecture.
Setup, testing, and evaluation instructions are complete and easy to follow.
The overall submission is structured well enough to be a strong future SCF/InstaAwards candidate.
## How To Submit Your Project
### Judging Portal
All teams must submit their project through the judging portal before the submission deadline. Incomplete or missing submissions will not be evaluated.
[Submission Portal](https://www.risein.com/programs/stellar-pro-hackathon)
Your submission must include:
- Team name and all team members' full names and contact information
- All relevant project links (GitHub repository, live demo, deployment URL)
- Presentation/pitch deck link
- Selection of the hackathon track(s) you are applying to
### Project Submission Criteria
All teams must submit their projects before the submission deadline. Incomplete submissions may not be evaluated.
1. The Narrative “Why”
Provide a brief overview of your project:
- What are you building?
- What problem does it solve?
- Who are your target users?
- Why is this problem worth solving?
- What is your value proposition?
2. Your MVP (Minimum Viable Product)
This is the primary deliverable of the hackathon.
Your submission must include:
- Public GitHub repository
- Well-structured README
- Deployed smart contract(s) on Stellar Testnet
- Front-end / application URL
- Working live demo (a functional, publicly accessible application that judges can interact with)
- Documented contract IDs and deployed artifacts
All smart contracts must be built using the Soroban SDK and deployed on Stellar Testnet.
3. Technical Documentation
Your project should be technically understandable through the README. A separate technical document is not required.
Explain how your system works from a technical perspective.
Include:
- Overall architecture
- Main components and their responsibilities
- Stellar integrations and protocols used
- Key design decisions and trade-offs
- Technical challenges and how you solved them
4. Pitch Presentation
All teams are required to use the official Stellar Pro Hackathon presentation template as the foundation for their submission.
You may add additional slides if needed, but the provided structure should remain intact.
Here is the Presentation Template. (TBD)

_(Judging-portal screenshot omitted: it shows other participants' names, emails and phone numbers.)_

| ⚠️ Important: You will only be evaluated for the tracks you select during submission. Projects will not be considered for tracks that were not chosen at the time of submission. |
|---|

## Workshop Details
Anchor Integration
This workshop is about that edge: how anchor works as a TRY anchor, how the underlying SEP flows turn a blockchain balance into money someone can actually spend or receive in Turkey, and why "does this integrate with local rails" is quickly becoming the question that separates a crypto demo from a product people use.

## What is Lounge Day?
Lounge Day is Scale Track only:  the room the rest of the hackathon builds toward.
Scale track teams pitch to the SDF team, and invited investors, founders and VCs.
"Traction" here means what SCF, InstAward, and real investors mean by it: a working integration, a roadmap for what happens after the Pro Hackathon, and a founder who can explain the product and what's next.
What you walk out with:
- Direct facetime with the investors, founders and VCs in the room
- ⁠A warm path into SCF and InstAward: Rise In and the Stellar team support the Scale teams on their application/next steps
- ⁠A Rise In referral into their network, for projects that fit
- [Next step funding](https://docs.google.com/document/d/1Z9U9P4l0kijxwY2jY-3Htel20ExosVMXgw2u2xRaiLE/edit?usp=sharing) beyond InstAward/SCF

## Other Details
### General Requirements
Project submissions must include the following:
The Narrative “Why”
- A brief explanation of what you are building, what it fixes, who it's helping, why it's important, and what your value proposition is.
Your MVP (Minimum Viable Product)
- This is the primary deliverable: your code. Provide a URL to your public GitHub repository with a well-defined README, your documented contracts, links to deployed artifacts, your front-end, and your working demo.
- Be sure to use the Soroban SDK and deploy your contracts to the Stellar testnet.
Technical Docs
- Technical design docs explaining how your project fits together, what the main components are, why you made various design decisions, what tradeoffs you made, and what challenges you overcame.

### Presentation Template
We have prepared an official presentation template for all teams. Please make a copy of the template and use it as the base for your pitch; do not present directly from the shared template file.
You are welcome to add additional slides as needed, but the provided structure should serve as your foundation. Using the template ensures judges can follow a consistent format and helps you cover all the key points they will be looking for.
📎[Presentation Template](https://docs.google.com/presentation/d/1oRWx77PH3WsQ67Is9Xhg3GVNmkwVO7lU4Ab241__ahE/edit?usp=sharing)

## Hacker Resources
Resource Hub’s
- Stellar Ecosystem Resources: [https://github.com/stellar/ecosystem-resources](https://github.com/stellar/ecosystem-resources)
- Stellar AI Skills: [https://skills.stellar.org/](https://skills.stellar.org/)
Smart Wallets
- Demo chat application - built specifically to help inspire you for this hackathon. Available in [Svelte/Astro](https://github.com/kalepail/smart-stellar-demo), [React](https://github.com/carstenjacobsen/smart-stellar-demo), and [Vanilla](https://github.com/elliotfriend/snapchain-demo) flavors.
- Passkey-Kit: [https://github.com/kalepail/smart-account-kit](https://github.com/kalepail/smart-account-kit)- a TypeScript SDK for creating and managing Stellar smart wallets.
- Smart Wallet Docs: [developers.stellar.org/docs/build/apps/smart-wallets](https://developers.stellar.org/docs/build/apps/smart-wallets) - knowledgebase, examples, and resources for using passkeys for wallet authentication.
- Smart Contract Authorization: [developers.stellar.org/docs/learn/encyclopedia/security/authorization](https://developers.stellar.org/docs/learn/encyclopedia/security/authorization) - the contract authorization framework for Stellar smart contracts.
Smart Contract Development
- Getting Started: [developers.stellar.org/docs/smart-contracts/getting-started/setup](https://developers.stellar.org/docs/smart-contracts/getting-started/setup) - the gateway to the Stellar smart contract developer experience.
- Example Contracts: [developers.stellar.org/docs/build/smart-contracts/example-contracts](https://developers.stellar.org/docs/build/smart-contracts/example-contracts) - sample code for DeFi features like liquidity pools, token swaps, etc.
Dapp Development
- Frontend Templates - fork and hit the ground running.
[Scaffold Stellar Astro Template](https://github.com/AhaLabs/scaffold-stellar-frontend)
[SvelteKit with Passkey Kit Template](https://github.com/ElliotFriend/soroban-template-sveltekit-passkeys)
- Guestbook Tutorial: [developers.stellar.org/docs/build/apps/guestbook/overview](https://developers.stellar.org/docs/build/apps/guestbook/overview) - a dapp tutorial with passkey-powered smart wallets.
- Build Applications Tutorials: [developers.stellar.org/docs/building-apps/overview](https://developers.stellar.org/docs/building-apps/overview) - JavaScript implementations of common wallet functionality.
- Stellar Design System: [design-system.stellar.org](https://design-system.stellar.org/) - components and styles for easier React development.

Explore the Network
- Stellar Lab: [lab.stellar.org](https://lab.stellar.org/) - interact with the network and query activity.
- Stellar.Expert: [stellar.expert](https://stellar.expert/) - block explorer for ledger entries, accounts, assets, analytics.

Connect to the Network
- OpenZeppelin Relayer: [docs.openzeppelin.com/relayer ](http://docs.openzeppelin.com/relayer)
- Stellar RPC: [developers.stellar.org/docs/data/apis/rpc](https://developers.stellar.org/docs/data/apis/rpc) - real-time access to Stellar network data.

Build on the Network
- Developer Tools: [developers.stellar.org/docs/tools/developer-tools](https://developers.stellar.org/docs/tools/developer-tools) - organized list of available tools and services.
- Get Testnet Funds [https://lab.stellar.org/account/fund?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015;;](https://lab.stellar.org/account/fund?$=network$id=testnet&label=Testnet&horizonUrl=https:////horizon-testnet.stellar.org&rpcUrl=https:////soroban-testnet.stellar.org&passphrase=Test%20SDF%20Network%20/;%20September%202015)
- SDK Library: [developers.stellar.org/docs/tools/sdks/library](https://developers.stellar.org/docs/tools/sdks/library) - Stellar SDKs in almost every language.
- Stellar Ecosystem Resources: [github.com/stellar/ecosystem-resources](https://github.com/stellar/ecosystem-resources) - resources for in-person events and hackathons.
- Frontend Bindings: [developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend) - generate a typed NPM package for frontend integration.

Stablecoin Resources
- Circle USDC and EURC Testnet Faucet: [faucet.circle.com](https://faucet.circle.com/) - testnet tokens for two widely circulated stablecoins.
- OpenZeppelin Open Source Relayer & Monitor Docs: [docs.openzeppelin.com/open-source-tools](https://docs.openzeppelin.com/open-source-tools/)
- a16z - How Stablecoins Will Eat Payments: [a16zcrypto.com](https://a16zcrypto.com/posts/article/how-stablecoins-will-eat-payments/)

Agentic Resources
- [https://developers.stellar.org/docs/build/agentic-payments](https://developers.stellar.org/docs/build/agentic-payments)
- [https://developers.stellar.org/docs/build/agentic-payments/x402](https://developers.stellar.org/docs/build/agentic-payments/x402)
- [https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar)
- [https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide](https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide)

Privacy Resources
- [https://developers.stellar.org/docs/build/apps/privacy](https://developers.stellar.org/docs/build/apps/privacy)
- [https://developers.stellar.org/docs/build/apps/zk](https://developers.stellar.org/docs/build/apps/zk)
- [https://github.com/kaankacar/Drand-Relay](https://github.com/kaankacar/Drand-Relay)
- [https://github.com/NethermindEth/stellar-private-payments](https://github.com/NethermindEth/stellar-private-payments)
Oracle
- [https://reflector.network/](https://reflector.network/)
- [https://developers.stellar.org/docs/data/oracles](https://developers.stellar.org/docs/data/oracles)
- [https://noeracle.org/](https://noeracle.org/) - [docs.noeracle.org](http://docs.noeracle.org)

---

## Appendix: official pitch template structure

Added by the Aidat team from the template linked above (read on 2026-09-19). Make a copy of the template; its structure must stay intact, extra slides are allowed.

| # | Slide | What the slide asks for | "Think" question |
|---|---|---|---|
| 1 | Cover | "Build on Stellar Hackathon" cover. It still shows an older event date ("June 2–3"); fix it in the copy. | — |
| 2 | The Solution | Show how the project solves the problem; present the idea as the answer to the pain point; keep it short, clear and exciting. | Why is your solution the best way to fix this? Highlight what makes it unique or better than other options. |
| 3 | PMF | The real-world issue: who is affected and how big the impact is; use numbers, examples or stories. | Why should anyone care about this problem? |
| 4 | Technical Workflow | How the solution works in practice; briefly describe the technology, product or process; logic and feasibility over detail. | How does this actually work — and why will it succeed? |
| 5 | The Team | Who is behind the project; skills and roles; a small team photo; at most 3 lines per member. | Why are you the right people to solve this problem? |
