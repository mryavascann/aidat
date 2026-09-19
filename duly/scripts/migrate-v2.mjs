// One-time, journaled testnet migration. The V1 treasury itself approves and
// transfers its balance; no administrative backdoor or key replacement.
import { strict as assert } from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Address, Operation, nativeToScVal } from '@stellar/stellar-sdk';
import { AnchorClient } from './lib/anchor.mjs';
import { toUnits } from './lib/amounts.mjs';
import { withState, journaled } from './lib/state.mjs';
import { ROOT, TOKEN, address, assertTestnet, call, contractId, i128, json, keyAt, readAs, recordProof, send, string, u32 } from './lib/soroban.mjs';

await assertTestnet();
await withState(async (state, save) => {
  const admin = await keyAt('.duly-admin-key');
  const member = await keyAt('.duly-testnet-key');
  const vault = (await readFile(resolve(ROOT, '.duly-vault-id'), 'utf8')).trim();
  const flow = state['migration-v2'] ??= { oldId: await contractId(), salt: randomBytes(32).toString('hex') };
  await save();
  if (flow.completed) { console.log('Duly V2 migration already completed.'); return; }
  const j = (step, fn) => journaled(flow, step, save, fn);
  // Seed the official vault separately. Its initial 1,000 locked share units
  // come from the administrator's sandbox funds, not the community's balance.
  if (!flow.seedOrder) {
    const anchor = await new AnchorClient(admin).discover();
    flow.seedOrder = await anchor.start('deposit', '50.00');
    await save();
  }
  if (!flow.seedSettlement) {
    const anchor = await new AnchorClient(admin).discover();
    if ((await anchor.transaction(flow.seedOrder.id)).status === 'pending_user_transfer_start') {
      await anchor.simulateDeposit(flow.seedOrder.id, flow.seedOrder.quote.sell_amount);
    }
    flow.seedSettlement = await anchor.wait(flow.seedOrder.id);
    await save();
  }
  await j('seedVault', onSigned => call(admin, vault, 'deposit', [
    nativeToScVal([toUnits('1')], { type: 'i128' }),
    nativeToScVal([toUnits('1')], { type: 'i128' }), address(admin.publicKey()), nativeToScVal(false),
  ], { onSigned }));
  const wasmPath = 'target/wasm32v1-none/release/duly_treasury.wasm';
  const wasm = await readFile(resolve(ROOT, wasmPath));
  const wasmHash = createHash('sha256').update(wasm).digest();
  await j('upload', onSigned => send(admin, Operation.uploadContractWasm({ wasm }), { onSigned }));
  const deployed = await j('deploy', onSigned => send(admin, Operation.createCustomContract({
    address: new Address(admin.publicKey()), wasmHash, salt: Buffer.from(flow.salt, 'hex'),
    constructorArgs: [address(admin.publicKey()), address(TOKEN), string('Pera Community'), i128(20000), u32(2), address(vault)],
  }), { onSigned }));
  const id = deployed.value;
  assert.equal((await readAs(id, 'config')).vault, vault);
  const members = await readAs(flow.oldId, 'members');
  for (const account of members.filter(m => m !== admin.publicKey())) {
    await j(`member:${account}`, onSigned => call(admin, id, 'add_member', [address(account)], { onSigned }));
  }
  if (!flow.amount) { flow.amount = (await readAs(flow.oldId, 'balance')).toString(); await save(); }
  assert(BigInt(flow.amount) > 0n);
  const proposal = await j('propose', onSigned => call(member, flow.oldId, 'propose', [
    address(member.publicKey()), address(id), i128(flow.amount), string('Duly V2 treasury migration'),
  ], { onSigned }));
  await j('approve', onSigned => call(admin, flow.oldId, 'approve', [address(admin.publicKey()), u32(Number(proposal.value))], { onSigned }));
  await j('execute', onSigned => call(member, flow.oldId, 'execute', [u32(Number(proposal.value))], { onSigned }));
  await j('invest', onSigned => call(admin, id, 'invest', [i128(flow.amount)], { onSigned }));
  assert.equal(await readAs(flow.oldId, 'balance'), 0n);
  assert.equal(await readAs(id, 'balance'), BigInt(flow.amount));
  assert.equal(await readAs(id, 'liquid_balance'), 0n);
  assert.equal(await readAs(id, 'vault_balance'), BigInt(flow.amount));
  const proof = JSON.parse(await readFile(resolve(ROOT, 'deployments/testnet.json'), 'utf8'));
  proof.brand = 'Duly';
  proof.version = 2;
  for (const account of Object.values(proof.accounts)) account.keyFile = account.keyFile.replace('.aidat-', '.duly-');
  delete proof.deposit; delete proof.demo; delete proof.withdrawal; delete proof.defindexProbe;
  delete proof.priorDeployments;
  proof.history = [{ proof: 'deployments/archive/aidat-testnet-v1.json', contractId: flow.oldId, reason: 'Replaced by Duly V2; full balance moved with two member approvals.' }];
  proof.wasm = { path: wasmPath, sha256: wasmHash.toString('hex'), uploadHash: flow.upload.result.hash };
  proof.treasury = { contractId: id, token: TOKEN, deploymentHash: deployed.hash, ledger: deployed.ledger, config: await readAs(id, 'config') };
  proof.migration = {
    oldContract: flow.oldId, newContract: id, amount: flow.amount,
    seedAnchorId: flow.seedOrder.id, seedSettlementHash: flow.seedSettlement.stellar_transaction_id,
    seedDepositHash: flow.seedVault.result.hash, seedAmount: '10000000', initialLockedUnits: '1000',
    proposeHash: flow.propose.result.hash, approveHash: flow.approve.result.hash,
    executeHash: flow.execute.result.hash, investHash: flow.invest.result.hash,
    oldBalanceAfter: '0', newVaultBalanceAfter: flow.amount,
  };
  await writeFile(resolve(ROOT, 'deployments/testnet.json'), `${json(proof)}\n`);
  await writeFile(resolve(ROOT, '.duly-contract-id'), `${id}\n`);
  flow.completed = true; await save();
  await recordProof('updatedAt', new Date().toISOString());
  console.log(`Duly V2 verified: ${id}`);
});
