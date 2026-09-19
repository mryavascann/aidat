# Duly frontend design package

Updated September 19, 2026. Implements the user's request to use the supplied
10k Websites skill and Higgsfield to refine the existing Duly frontend.

## Premise and scope

One shared balance, decisions made together, a record anyone in the community
can follow. The user's earlier MVP scope remains the product boundary. This is
a visual refinement of the working React application, its four existing views
and payment dialogs. The existing contract, account roles and payment recovery
remain the implementation baseline.

The supplied skill is aimed at new cinematic marketing sites. For this existing
financial application, apply its composition, signature imagery, typography,
motion, contrast and device-testing standards to the current React screens.
Use one generated still and brief interface motion. A pinned multi-screen video
journey would delay access to the balance and payments, so it is outside this
MVP. No additional marketing page, pricing, lead form or hosting migration is
part of the user's frontend request.

## Audience evidence

Public community discussions repeatedly ask where dues go and how to see the
financial record: [dues visibility](https://www.reddit.com/r/HOA/comments/10mb2kv/)
and [financial transparency](https://www.reddit.com/r/fuckHOA/comments/1jzg800/).
These are qualitative design references, not Duly customer interviews or
traction. Lead with the shared balance; make decisions and receipts easy to
inspect. Do not add testimonials, growth figures or invented payment activity.

## Palette and type

- Light: cool pearl canvas, off-white panels, deep forest text.
- Dark: deep forest canvas, slightly raised green panels, soft white text.
- Accent: emerald in light mode, mint in dark mode. Reserve emphasis for the
  primary action, active navigation and keyboard focus.
- Signature balance panel: deep green in both modes, readable white values,
  one jade-glass sculpture on the right with a calm area for live figures.
- Display: Manrope, 500–700. Body: DM Sans, 400–650. Labels and references:
  DM Mono, 400. Fonts are self-hosted and support Turkish glyphs.

## Screen composition and copy

The existing English and Turkish transaction copy is preserved unless listed
here. These authored strings ship verbatim in their respective locale files.

- Overview title: “A shared balance. A shared say.” / “Ortak kasa. Ortak karar.”
- Overview introduction: “Collect contributions, decide together, follow every payment.” /
  “Katkıları toplayın, birlikte karar verin, her ödemeyi izleyin.”
- Treasury label: “Your community fund” / “Topluluğunuzun kasası”.
- Public next action title: “Good things start together.” / “İyi şeyler birlikte başlar.”
- Public next action description: “Create a test community and try your first shared decision.” /
  “Bir test topluluğu kurun, ilk ortak kararınızı deneyin.”
- Reserve heading: “Ready for your next decision.” / “Bir sonraki kararınıza hazır.”
- Ledger heading: “Every move, accounted for.” / “Her hareketin kaydı burada.”

The overview uses a signature balance panel beside one contextual next action,
a quiet three-metric strip, a compact three-step navigation rail, then decisions,
reserve details and a chronological ledger. The existing actions are the
interactive proof. Payment and member views use the same type, spacing, controls
and state colors. No visual mock data is introduced.

## Higgsfield art direction

One still, GPT Image 2.5, 16:9. Preflight: 1 credit. Three rounded jade-glass
arches meet around a matte ivory sphere, on a continuous deep forest studio
surface. The sculpture sits on the right. The left is calm, in the same scene.
Soft window light, physical contact shadows, restrained materials. No text,
logos, currency, interface screenshots, people or invented product claims.
The mark and application text stay crisp in SVG/HTML.

Inspect the result before shipping it. Keep the raw generation outside the web
public directory. Deliver a compressed responsive WebP and a small mobile
variant. The application remains readable and operable if the asset fails.

Delivered asset: job `b598b746-977c-4d77-8e98-0fd9d987552c`, generated September
19, 2026 with Higgsfield `gpt_image_2_5`, one 16:9 image. Visually inspected before
integration. `cwebp` produced three variants from the original in one compression
pass each: 1344×752 at 29,982 bytes, 1008×564 at 13,074 bytes and 672×376 at
7,510 bytes. The browser selects with `srcset`; HTML keeps the balances, text and
logo separate from the decorative image. The raw generation and supplied ZIP
are local review materials and are excluded from deployment and Git.

## Motion and verification

Use short opacity/transform entrances and responsive hover feedback, with no
scroll capture or payment delays. The shared-circle motif appears in the
generated art and small vector details, not in additional product modules.
Reduced motion removes decorative transitions, including pseudo-elements.
Financial values and status changes remain immediate.

Verify desktop, tablet and touch layouts, both themes, keyboard controls,
reduced-motion changes, missing image behavior and all existing dialogs. Run
the production build, browser/navigation checks, theme tests, payment model
tests and automated accessibility/recovery checks. Preserve saved payment and
theme preferences across navigation. Inspect screenshots before delivery.

Copy gate: concise factual copy, no em dashes or stock marketing claims in the
authored UI text. Do not paraphrase the authored strings while wiring the view.

## Verification completed

- Production build and 10 payment-model tests pass. Financial functions, stored
  payment data and contract code were not modified; no payment was submitted by
  this visual pass.
- Browser navigation and TR/EN controls pass. Theme initialization, live device
  changes, saved preferences, keyboard toggle and the external wallet chooser
  pass the existing theme suite.
- Automated WCAG A/AA checks report no violations in 24 page/dialog scenarios
  and 16 additional payment-recovery scenarios across light/dark and 1440/360px.
  Recovery covers expiry, authenticated status checking, settled contribution,
  completed receipt, reload and account isolation.
- Light/dark screenshots inspected at 1440, 1280, 768, 375 and 360px. All four
  views were also checked in English at 360, 700, 701, 981 and 1201px by an
  independent reviewer. No horizontal overflow or uncaught browser error found.
- Blocking all generated image requests leaves balances and actions available.
  Changing reduced-motion preference while the page stays open removes the
  decorative animation. Visible mobile overview buttons have 44px targets.
- A keyboard check caught an existing native-dialog focus escape and missing
  restoration after React unmount. Explicit Tab/Shift+Tab wrapping and trigger
  restoration fix it; the browser regression check covers both boundaries,
  Escape and reopening. Payment and wallet-chooser checks pass afterward.
- An independent review of the finished design and the focus fix reported no
  actionable findings. Current screenshots are in `docs/screenshots/`.

The existing large wallet/chain bundle warning remains (about 237 KB gzip for
the main JavaScript chunk); this pass adds fonts and 7–30 KB responsive art, with
no animation library or video download. Public HTTPS deployment and installed
external-wallet signing remain the previously documented delivery checks.
