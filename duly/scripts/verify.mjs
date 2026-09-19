import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Address, xdr } from '@stellar/stellar-sdk';
import { ROOT, TOKEN, USDC_ISSUER, address, assertTestnet, horizon, i128, readAs, server, u32 } from './lib/soroban.mjs';
import { toUnits } from './lib/amounts.mjs';

// Public, read-only proof verification: no secret key files are read.
await assertTestnet();
const proof = JSON.parse(await readFile(resolve(ROOT, 'deployments/testnet.json'), 'utf8'));
const id = proof.treasury.contractId;
const config = await readAs(id, 'config');
assert.equal(config.admin, proof.accounts.admin.publicKey);
assert.equal(config.token, TOKEN);
assert.equal(config.quorum, 2);
assert.equal(config.vault, proof.vault.contractId);
const assets = await readAs(config.vault, 'get_assets');
assert.equal(assets.length, 1);
assert.equal(assets[0].address, TOKEN);
assert.equal(assets[0].strategies.length, 0, 'This deployment records a liquid reserve, not an active yield strategy.');
const shares = await readAs(config.vault, 'balance', [address(id)]);
const backing = shares > 0n ? (await readAs(config.vault, 'get_asset_amounts_per_shares', [i128(shares)]))[0] : 0n;
assert.equal(await readAs(id, 'vault_balance'), backing);
assert.equal(await readAs(id, 'balance'), (await readAs(id, 'liquid_balance')) + backing);
if (proof.migration) assert.equal(await readAs(proof.migration.oldContract, 'balance'), 0n);

const instanceKey = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
  contract: new Address(id).toScAddress(),
  key: xdr.ScVal.scvLedgerKeyContractInstance(),
  durability: xdr.ContractDataDurability.persistent,
}));
const entries = await server.getLedgerEntries(instanceKey);
assert.equal(entries.entries.length, 1, 'Treasury instance is unavailable (testnet may have reset).');
const deployedHash = Buffer.from(entries.entries[0].val.contractData.val.instance.executable.wasmHash.value).toString('hex');
assert.equal(deployedHash, proof.wasm.sha256, 'On-chain WASM hash differs from the deployment record.');
const wasm = await readFile(resolve(ROOT, proof.wasm.path));
assert.equal(createHash('sha256').update(wasm).digest('hex'), deployedHash, 'Local WASM differs from on-chain WASM.');
if (proof.wasm.buildPath) {
  let built;
  try { built = await readFile(resolve(ROOT, proof.wasm.buildPath)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (built) assert.equal(createHash('sha256').update(built).digest('hex'), deployedHash, 'Freshly built WASM differs from the published artifact.');
}

const hashes = new Set([
  ...Object.values(proof.accounts).flatMap(account => [account.fundingHash, account.trustlineHash]),
  proof.wasm.uploadHash, proof.treasury.deploymentHash,
  proof.deposit?.inviteHash, proof.deposit?.joinHash, proof.deposit?.stellarHash, proof.deposit?.contributionHash,
  proof.demo?.proposeHash, proof.demo?.approveHash, proof.demo?.executeHash, proof.withdrawal?.paymentHash,
  proof.vault.creationHash,
  ...Object.entries(proof.migration ?? {}).filter(([key]) => key.endsWith('Hash')).map(([, hash]) => hash),
].filter(Boolean));
for (const hash of hashes) {
  assert.match(hash, /^[0-9a-f]{64}$/);
  const tx = await horizon.transactions().transaction(hash).call();
  assert.equal(tx.successful, true, `Transaction failed: ${hash}`);
}

if (proof.deposit) {
  assert.equal(proof.deposit.treasury, id);
  const cumulative = await readAs(id, 'contribution', [address(proof.deposit.account)]);
  assert(cumulative >= toUnits(proof.deposit.contributionAmount));
  const ops = await horizon.operations().forTransaction(proof.deposit.stellarHash).call();
  assert(ops.records.some(op => {
    if (op.type === 'payment') return op.to === proof.deposit.account && op.asset_code === 'USDC' &&
      op.asset_issuer === USDC_ISSUER && toUnits(op.amount) === toUnits(proof.deposit.amountOut);
    if (op.type === 'create_claimable_balance') return op.asset === `USDC:${USDC_ISSUER}` &&
      toUnits(op.amount) === toUnits(proof.deposit.amountOut) && op.claimants.some(c => c.destination === proof.deposit.account);
    return false;
  }), 'Anchor settlement operation does not match the recorded deposit.');
}
if (proof.demo) {
  assert.equal(proof.demo.treasury, id);
  const proposal = await readAs(id, 'proposal', [u32(proof.demo.proposalId)]);
  assert.equal(proposal.status[0], 'Executed');
  assert.equal(proposal.payee, proof.accounts.payee.publicKey);
  assert.equal(proposal.amount, toUnits(proof.demo.amountUSDC));
  const voters = await readAs(id, 'approvals', [u32(proof.demo.proposalId)]);
  assert(new Set(voters).size >= config.quorum);
}
if (proof.withdrawal) {
  const tx = await horizon.transactions().transaction(proof.withdrawal.paymentHash).call();
  assert.equal(tx.memo_type, 'id');
  assert.equal(tx.memo, proof.withdrawal.memo);
  const ops = await horizon.operations().forTransaction(proof.withdrawal.paymentHash).call();
  assert(ops.records.some(op => op.type === 'payment' && op.from === proof.withdrawal.account &&
    op.to === proof.withdrawal.anchorAccount && op.asset_code === 'USDC' && op.asset_issuer === USDC_ISSUER &&
    toUnits(op.amount) === toUnits(proof.withdrawal.amountIn)));
}
console.log(`Verified ${hashes.size} successful testnet transactions, on-chain/local WASM equality, Circle USDC vault backing, migration and payment flow.`);
console.log(`Treasury: ${id}`);
console.log('Bank reference is a sandbox receipt, not proof of real fiat settlement.');
