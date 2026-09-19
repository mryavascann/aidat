import { strict as assert } from 'node:assert';
import { parseArgs } from 'node:util';
import { toUnits, fromUnits } from './lib/amounts.mjs';
import { ensureMember } from './lib/membership.mjs';
import { journaled, withState } from './lib/state.mjs';
import { address, assertTestnet, call, contractId, i128, keyAt, readAs, recordProof, string, u32, usdcBalance } from './lib/soroban.mjs';

const { values } = parseArgs({ options: { fresh: { type: 'boolean', default: false } } });
await assertTestnet();
await withState(async (state, save) => {
  const id = await contractId();
  const admin = await keyAt('.duly-admin-key');
  const member = await keyAt('.duly-testnet-key');
  const payee = await keyAt('.duly-payee-key');
  const stateKey = `demo:${id}`;
  let flow = state[stateKey];
  if (values.fresh && flow && !flow.completed) throw new Error('Finish the saved expense before starting another one.');
  if (!flow || values.fresh) {
    flow = state[stateKey] = { createdAt: new Date().toISOString(), treasury: id };
    await save();
  }
  if (flow.completed) {
    console.log(`Expense ${flow.proposalId} already executed; use --fresh to intentionally propose another expense.`);
    return;
  }
  await ensureMember(admin, member, id);
  const amount = toUnits('2');
  if (!flow.propose) {
    if (await readAs(id, 'balance') < amount) throw new Error('Treasury needs at least 2 USDC. Run npm run anchor:deposit first.');
    flow.balanceBefore = (await readAs(id, 'balance')).toString();
    flow.payeeBefore = await usdcBalance(payee.publicKey());
    await save();
  }
  const proposed = await journaled(flow, 'propose', save, onSigned => call(member, id, 'propose', [
    address(member.publicKey()), address(payee.publicKey()), i128(amount), string('Elevator maintenance - testnet demo'),
  ], { onSigned }));
  flow.proposalId = Number(proposed.value);
  await save();
  const proposalId = u32(flow.proposalId);
  if (!flow.approve) {
    assert.equal((await readAs(id, 'approvals', [proposalId])).length, 1);
    // Read-only simulation proves that an expense cannot execute with one vote.
    await assert.rejects(readAs(id, 'execute', [proposalId]), /Error\(Contract, #17\)/);
    console.log('Verified: execution rejected before quorum.');
  }
  await journaled(flow, 'approve', save, onSigned => call(admin, id, 'approve', [address(admin.publicKey()), proposalId], { onSigned }));
  await journaled(flow, 'execute', save, onSigned => call(member, id, 'execute', [proposalId], { onSigned }));
  const proposal = await readAs(id, 'proposal', [proposalId]);
  const approvals = await readAs(id, 'approvals', [proposalId]);
  const balanceAfter = await readAs(id, 'balance');
  const payeeAfter = await usdcBalance(payee.publicKey());
  assert.equal(Array.isArray(proposal.status) ? proposal.status[0] : proposal.status, 'Executed');
  assert.equal(proposal.payee, payee.publicKey());
  assert.equal(proposal.amount, amount);
  assert.equal(approvals.length, 2);
  assert.equal(balanceAfter, BigInt(flow.balanceBefore) - amount);
  assert.equal(toUnits(payeeAfter), toUnits(flow.payeeBefore) + amount);
  await recordProof('demo', {
    treasury: id, proposalId: flow.proposalId, amountUSDC: fromUnits(amount),
    proposeHash: flow.propose.result.hash, approveHash: flow.approve.result.hash, executeHash: flow.execute.result.hash,
    approvals, status: 'Executed', balanceAfter: fromUnits(balanceAfter), payeeAfter,
    rejectedBeforeQuorum: true,
  });
  flow.completed = true;
  await save();
  console.log(`Expense ${flow.proposalId} paid ${fromUnits(amount)} USDC. Treasury ${fromUnits(balanceAfter)} USDC; payee ${payeeAfter} USDC.`);
});
