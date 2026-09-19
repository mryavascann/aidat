import { assertTestnet, json, readAs, recordProof, TOKEN } from './lib/soroban.mjs';

// Check the official deployment list and actual vault assets before attempting
// any integration. A token named USDC is not necessarily Circle testnet USDC.
await assertTestnet();
const source = 'https://raw.githubusercontent.com/defindex-io/stellar-contracts/main/public/testnet.contracts.json';
const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Cannot read official DeFindex testnet deployments: ${response.status}`);
const deployments = await response.json();
const vault = deployments.ids.usdc_paltalabs_vault;
const assets = await readAs(vault, 'get_assets');
const funds = await readAs(vault, 'fetch_total_managed_funds');
const result = {
  checkedAt: new Date().toISOString(), source, vault, assets, funds,
  expectedCircleToken: TOKEN,
  compatibleSingleAssetVault: assets.length === 1 && assets[0].address === TOKEN,
  verification: 'Read-only asset/interface probe; no deposit, investment or withdrawal performed.',
};
await recordProof('defindexProbe', result);
console.log(json(result));
if (!result.compatibleSingleAssetVault) console.log('The published vault does not accept Circle testnet USDC. Do not send treasury funds to it.');
