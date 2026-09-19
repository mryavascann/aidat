# Duly design reference

## Product voice

A shared building ledger: calm, legible and factual. Residents should understand
who paid, what an expense is for, who approved it, and what is left in the fund.
The brand is **Duly**: a shared treasury for communities. The user selected this
name on September 19 for an international audience. Use the same spelling in the
wordmark, packages, page titles and product copy; the historical GitHub URL stays
unchanged until its owner renames the repository.

Provide English and Turkish via `web/src/i18n/en.ts` and `web/src/i18n/tr.ts`.
Default to Turkish for the local hackathon, with a visible language switch.
All other source files and documentation are English. Avoid promises about returns
or inflation protection. The first DeFindex integration is an idle USDC vault
without a yield strategy, so never display an invented APY.

## Visual system

- Background: pearl `#F4F6F2`; surfaces: `#FCFDFB`; text: forest `#19392F`.
- Primary action: deep teal `#176B58`; subtle green surface: `#E6F0E6`.
- Secondary text: `#566B60`; separators: `#DCE5DC`; input borders: `#768C7C`.
- Pending: amber `#775714` on `#F7EFDD`; failure: `#96533E` on `#FFF4F0`.
- Typography: self-hosted Manrope for headings and balances, DM Sans for body
  copy, DM Mono for short labels and references. All support Turkish glyphs.
  Body copy 12–14px, captions at least 10px, headings 24–42px; money uses tabular
  numerals. Preserve WCAG AA text contrast in both themes.
- Layout: 232px desktop navigation and 38px main gutters, narrowing at tablet
  sizes. On mobile the navigation becomes a labeled bottom bar, with 16–20px
  gutters and space for the device's safe area. The overview uses a signature
  balance panel, one next action, a flat metric strip, and a compact journey rail.
  Spacing scale: 4, 8, 12, 16, 24, 32, 48px. Main card radius: 20px.
- Wordmark: lowercase `duly` with a small geometric green D mark; create it in SVG.
  The balance panel stays deep forest `#0C302A` in both themes, with white figures
  over jade glass arches generated with Higgsfield. The sculpture represents a
  shared fund, never an actual product or financial result. A gradient keeps text
  readable; the solid panel remains usable when the decorative image fails.
  Numbers carry the composition; form fields and secondary panels stay quiet.
- Borders define groups; shadows are reserved for dialogs. No decorative charts,
  fabricated activity or cryptocurrency imagery. The generated scene is the one
  signature visual; avoid adding generic illustrations to every card.

The [frontend design package](planning/frontend-design-package.md) records the
adaptation of the user-supplied 10k Websites skill, approved MVP boundary,
authored copy, Higgsfield provenance and verification. Its cinematic marketing
site workflow informs the existing React application rather than introducing a
separate site, pinned video experience or hosting dependency.

## Theme

Dark mode uses a forest background `#101A16`, raised surfaces `#19271F`, text
`#EDF3EC` and muted text `#AEBFB2`. Primary actions use mint `#9CDDBA` with dark
text `#10251A`. Status, focus, borders, reserve art and dialogs use semantic color
tokens; do not invert the page or animate foreground/background color changes.

Use the device preference until a user chooses light/dark with the 44px top-bar
switch. Save that choice in `duly:theme`; apply it before React loads to avoid a
light flash. Set native `color-scheme`, browser theme color and the Wallets Kit
chooser to the selected theme. Keep the same layout and payment behavior in both
themes. Theme choice needs no settings page or new product navigation.

## Information and interactions

Show the fund balance and an account-aware next action first: resume an unfinished
payment, review approvals, contribute or withdraw. Follow with the three real
summary metrics, the collection/decision/receipt rail, expenses and the ledger.
Keep bank deposit/withdrawal actions in their own tab, followed by scoped payment
history. Payment dialogs show three evidence-based stages and preserve receipts.
Amounts display TRY first and the exact USDC amount second.
Use the anchor's sell rate to value the fund and its buy quote for a deposit;
include the quote expiry and distinguish an estimate from a locked quote.

An expired quote must not be presented as proof that a submitted payment failed.
Show the saved order and a bank-status check. A settled deposit still needs its
community contribution before it is complete. History is labeled as belonging to
the selected wallet, community and browser. See [the UX specification](planning/ux-design-specification.md).

Each expense shows purpose, payee label, amount, approval count and state. State
must use text and an icon as well as color. Show immutable chain evidence through
a secondary explorer link. Do not put account addresses or hashes in the normal
resident flow; keep technical details in an expandable proof panel.

Viewing needs no wallet. Joining uses a QR/code; signing is needed for membership,
contributions and approvals. A browser key is explicitly a disposable testnet
account. Never put an administrator secret in a client bundle or invite URL.

Use a persistent sandbox indicator: bank transfers and bank payouts are simulated,
while Stellar testnet transfers are real. A failed or pending payment must retain
its reference so users can resume it without paying twice. Never show success
before a confirmed chain result or a completed anchor status.

## Accessibility and mobile

Use semantic buttons, explicit form labels, keyboard focus rings and status
announcements. Touch targets are at least 44px. Dialogs trap focus and restore it
on close. Money and long account references must not overflow a 360px viewport.
Empty, loading, failure and disconnected states receive the same care as success.
Respect reduced motion; loading must not depend on animation alone.
