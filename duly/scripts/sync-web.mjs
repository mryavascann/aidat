// Explicit allowlist: private journals and key files can never enter the bundle.
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const proof = JSON.parse(await readFile(new URL('deployments/testnet.json', root), 'utf8'));
const config = {
  brand: 'Duly', network: proof.network, treasury: proof.treasury.contractId,
  vault: proof.vault.contractId, wasmHash: proof.wasm.sha256,
  deploymentHash: proof.treasury.deploymentHash, deployedAtLedger: proof.treasury.ledger,
  accounts: Object.fromEntries(Object.entries(proof.accounts).map(([role, a]) => [role, a.publicKey])),
};
await writeFile(new URL('web/src/deployment.json', root), `${JSON.stringify(config, null, 2)}\n`);
console.log('Synced public Duly deployment to web.');
