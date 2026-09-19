import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Address, Operation } from '@stellar/stellar-sdk';
import { ROOT, TOKEN, address, assertTestnet, i128, keyAt, readAs, recordProof, send, string, u32 } from './lib/soroban.mjs';

async function main() {
  const { values } = parseArgs({ options: { new: { type: 'boolean', default: false } } });
  await assertTestnet();
  const admin = await keyAt('.duly-admin-key');
  const idPath = resolve(ROOT, '.duly-contract-id');
  let existing;
  try { existing = (await readFile(idPath, 'utf8')).trim(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const wasmPath = 'target/wasm32v1-none/release/duly_treasury.wasm';
  const wasm = await readFile(resolve(ROOT, wasmPath));
  let vault;
  try { vault = (await readFile(resolve(ROOT, '.duly-vault-id'), 'utf8')).trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // New checkouts can reuse the verified, already-seeded Circle reserve.
    vault = JSON.parse(await readFile(resolve(ROOT, 'web/src/deployment.json'), 'utf8')).vault;
  }
  const assets = await readAs(vault, 'get_assets');
  if (assets.length !== 1 || assets[0].address !== TOKEN) throw new Error('Vault does not accept Circle testnet USDC.');
  const wasmHash = createHash('sha256').update(wasm).digest();
  if (existing && !values.new) {
    const config = await readAs(existing, 'config');
    if (config.admin !== admin.publicKey() || config.token !== TOKEN || config.vault !== vault) throw new Error('Local deployment does not match these testnet accounts and reserve.');
    const proof = JSON.parse(await readFile(resolve(ROOT, 'deployments/testnet.json'), 'utf8'));
    if (proof.wasm.sha256 !== wasmHash.toString('hex')) throw new Error('Local WASM differs from the deployment. Use --new only for an empty treasury.');
    console.log(`Existing treasury and local WASM verified: ${existing}`);
    return;
  }
  if (existing) {
    if (await readAs(existing, 'balance') !== 0n) throw new Error('Refusing to replace a funded treasury reference.');
    const proof = JSON.parse(await readFile(resolve(ROOT, 'deployments/testnet.json'), 'utf8'));
    await recordProof('priorDeployments', [...(proof.priorDeployments ?? []), { ...proof.treasury, wasm: proof.wasm, retiredReason: 'Rebuilt before funding; balance was zero.' }]);
  }
  const upload = await send(admin, Operation.uploadContractWasm({ wasm }), { label: 'Upload treasury WASM' });
  await recordProof('wasm', { path: wasmPath, sha256: wasmHash.toString('hex'), uploadHash: upload.hash });
  const deployment = await send(admin, Operation.createCustomContract({
    address: new Address(admin.publicKey()),
    wasmHash,
    salt: randomBytes(32),
    constructorArgs: [address(admin.publicKey()), address(TOKEN), string('Pera Community'), i128(20000), u32(2), address(vault)],
  }), { label: 'Deploy and initialize treasury' });
  const id = deployment.value;
  if (typeof id !== 'string' || !id.startsWith('C')) throw new Error('Deployment returned no contract address.');
  await writeFile(idPath, `${id}\n`, { flag: existing ? 'w' : 'wx' });
  const config = await readAs(id, 'config');
  if (config.admin !== admin.publicKey() || config.token !== TOKEN || config.quorum !== 2) {
    throw new Error('Deployed configuration verification failed.');
  }
  await recordProof('treasury', { contractId: id, token: TOKEN, deploymentHash: deployment.hash, ledger: deployment.ledger, config });
  console.log(`Treasury: https://stellar.expert/explorer/testnet/contract/${id}`);
}

await main();
