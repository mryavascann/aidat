# Duly on Vercel

Production demo: **https://duly-sepia.vercel.app**

Initial publication: September 19, 2026 from `codex/treasury-foundation` at `9221d5f`.
Vercel project: `duly` in `sametgoc81tr-4111s-projects`.
Initial deployment: `dpl_JE7y6zaZ4qRPotbgBgGoGqoVntA5`.
[Build and deployment](https://vercel.com/sametgoc81tr-4111s-projects/duly/JE7y6zaZ4qRPotbgBgGoGqoVntA5).
The bank-payment fix at `ff60508` is published as
[`dpl_DFjMGyzt6Dg7nhVNu7MTjbJDQRNe`](https://vercel.com/sametgoc81tr-4111s-projects/duly/DFjMGyzt6Dg7nhVNu7MTjbJDQRNe).
The production alias returns HTTP 200 and its JavaScript bundle matches the
locally tested build (SHA-256 `4508b00dd9763cbdde3b87d1e0d95572d3657490e953e9d7cda529bba94d39e9`).
The repository is public; the current
[implementation branch](https://github.com/mryavascann/aidat/tree/codex/treasury-foundation)
contains the application and deployment configuration.

The application uses Stellar **testnet** and the existing simulated bank anchor.
The public URL changes hosting only; it does not change the network, contracts,
roles or payment behavior. Browser demo accounts and saved payments belong to
their browser origin, so localhost storage is separate from this HTTPS origin.

## Build and publish

Run commands from the repository root. `vercel.json` selects Vite and configures:

- Install: `npm ci --prefix duly/web`.
- Build: `npm --prefix duly run web:build`.
- Published output: `duly/web/dist`.

The build synchronizes an explicit list of public deployment fields before
compiling the frontend. No hosted secret or API key is required by the app.
`.vercelignore` includes only the web app, the three shared browser-safe modules,
the public deployment record, and the build/configuration files. CLI inspection
confirmed 34 input files (515,655 bytes). The supplied skill ZIP, raw art, private
keys, recovery journals and local test state are excluded.

```sh
npm --prefix duly run web:build
npx --yes vercel@59.23.2 link --yes --project duly --scope sametgoc81tr-4111s-projects
npx --yes vercel@59.23.2 deploy --dry --json
npx --yes vercel@59.23.2 deploy --prod --yes --scope sametgoc81tr-4111s-projects
```

The CLI uses the account's existing Vercel login. Local project metadata under
`.vercel/` and any local environment files it creates are ignored by Git and
excluded from upload. The project currently deploys through the CLI; a GitHub
automatic-deployment connection was not established. Do not assume a Git push
updates the website. If connecting Git later, use the implementation branch and
the repository-root configuration above.

## Verification

The production URL returns HTTP 200 without a Vercel login. Its served hero
asset matches the local SHA-256. Source paths, the skill ZIP, local environment
files and private recovery-state paths return HTTP 404.

The browser and theme suites run against the actual HTTPS origin using
`DULY_URL=https://duly-sepia.vercel.app`, covering public chain data, Turkish and
English navigation, 360px layout, dialogs, keyboard focus, stored theme
preferences and the Freighter/xBull/Albedo chooser. Recovery fixtures exercise
saved-payment states without submitting a transfer. Installed external-wallet
signing and QR use on a physical phone still require a hands-on check.

Reference: [Vercel CLI deployments](https://vercel.com/docs/projects/deploy-from-cli)
and [upload allowlists](https://vercel.com/docs/deployments/vercel-ignore).

## Bank payment regression — September 19, 2026

The production Freighter account displayed its 100 test USDC, but requesting a
withdrawal quote failed because the workshop returned null limits. The shared
client now uses Duly's displayed sandbox bounds when limits are missing and
still validates published bounds. A nonmember explanation now appears beside
the disabled contribution button.

Validation: 16 script tests, 10 payment-model tests and the production build
passed. The built app was exercised in an independent browser demo using actual
Stellar testnet transactions and the workshop's simulated bank:

- A 200 TRY deposit quote survived a reload with the same bank reference;
  [4.0792181 USDC reached the treasury](https://stellar.expert/explorer/testnet/tx/b061b55a847d891dca5e7c7350d6f962b55893b87194a7ea1ed07f84746e179e).
- Two different demo members approved a
  [2 USDC expense](https://stellar.expert/explorer/testnet/tx/673004ed18302e93ae4efbb29a3dfe527be8235f29ebf9676d40a19683e4d4cd).
  The payee's on-chain USDC balance changed from zero to two.
- The payee [withdrew 2 USDC](https://stellar.expert/explorer/testnet/tx/552aa4286e86e9e763abeb9c537782da78930c8ad7f4f54be765147adbf9ff43).
  The UI confirmed a simulated 97.08 TRY payout, bank receipt `FAST-JBN60JIB36`.

The current UI supports TRY bank contributions, approved USDC expenses and
USDC-to-TRY withdrawals. It does not expose a direct wallet-USDC contribution
or a fiat USD deposit. Contributions require membership in the selected
treasury; having wallet funds alone does not grant membership.
