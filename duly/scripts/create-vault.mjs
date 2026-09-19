import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { ROOT, TOKEN, address, assertTestnet, call, keyAt, readAs, recordProof, string, u32 } from './lib/soroban.mjs';
import { journaled, withState } from './lib/state.mjs';

const FACTORY = 'CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32';
const ROUTER = 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD';
const map = pairs => xdr.ScVal.scvMap(pairs.map(([key, val]) => new xdr.ScMapEntry({ key, val })));
const symbol = value => nativeToScVal(value, { type: 'symbol' });

await assertTestnet();
await withState(async (state, save) => {
  const admin = await keyAt('.duly-admin-key');
  const flow = state['circle-vault'] ??= {};
  const roles = map([0, 1, 2, 3].map(role => [u32(role), address(admin.publicKey())]));
  // The official factory supports assets with no strategies. Funds remain
  // liquid; this is real vault share accounting, with no claimed yield.
  const assets = xdr.ScVal.scvVec([map([
    [symbol('address'), address(TOKEN)],
    [symbol('strategies'), xdr.ScVal.scvVec([])],
  ])]);
  const result = await journaled(flow, 'create', save, onSigned => call(admin, FACTORY, 'create_defindex_vault', [
    roles, u32(0), assets, address(ROUTER),
    map([[string('name'), string('Duly Circle Reserve')], [string('symbol'), string('DULY')]]),
    nativeToScVal(false),
  ], { onSigned }));
  const id = result.value;
  const actualAssets = await readAs(id, 'get_assets');
  if (actualAssets.length !== 1 || actualAssets[0].address !== TOKEN) throw new Error('Created vault asset mismatch.');
  await writeFile(resolve(ROOT, '.duly-vault-id'), `${id}\n`);
  await recordProof('vault', {
    contractId: id, factory: FACTORY, creationHash: result.hash, ledger: result.ledger,
    token: TOKEN, assets: actualAssets, upgradable: false, vaultFeeBps: 0,
    mode: 'idle', yieldStrategy: null,
  });
  console.log(`Circle USDC vault verified: ${id}`);
});
