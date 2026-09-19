import { parseArgs } from 'node:util';
import { Memo, Operation } from '@stellar/stellar-sdk';
import { AnchorClient, STELLAR_USDC } from './lib/anchor.mjs';
import { fromUnits, toUnits } from './lib/amounts.mjs';
import { ensureMember } from './lib/membership.mjs';
import { journaled, withState } from './lib/state.mjs';
import {
  USDC, address, assertTestnet, call, contractId, i128, keyAt, recordProof,
  send, trustline, usdcBalance,
} from './lib/soroban.mjs';

const { values } = parseArgs({ options: {
  only: { type: 'string', default: 'deposit' },
  try: { type: 'string', default: '200' },
  usdc: { type: 'string', default: '2' },
  key: { type: 'string', default: '.duly-testnet-key' },
  fresh: { type: 'boolean', default: false },
} });
if (!['deposit', 'withdraw'].includes(values.only)) throw new Error('--only must be deposit or withdraw.');
const deposit = values.only === 'deposit';
const amount = fromUnits(toUnits(deposit ? values.try : values.usdc, deposit ? 2 : 7), deposit ? 2 : 7);

await assertTestnet();
await withState(async (state, save) => {
  const key = await keyAt(values.key);
  const treasury = deposit ? await contractId() : undefined;
  const stateKey = `${key.publicKey()}:${values.only}:${treasury ?? 'wallet'}`;
  let flow = state[stateKey];
  if (values.fresh && flow && !flow.completed) throw new Error('Resume the unfinished anchor flow before starting a new one.');
  if (!flow || values.fresh) {
    flow = state[stateKey] = { kind: values.only, account: key.publicKey(), amount, treasury, createdAt: new Date().toISOString() };
    await save();
  }
  if (flow.amount !== amount) throw new Error('Saved flow has a different amount; finish it before using --fresh.');
  if (flow.completed) {
    console.log(`Already completed: ${flow.order.id}. Use --fresh to intentionally create another sandbox payment.`);
    return;
  }
  await trustline(key);
  const anchor = await new AnchorClient(key).discover();
  if (deposit) {
    const membership = await ensureMember(await keyAt('.duly-admin-key'), key, treasury);
    flow.membership = { ...flow.membership, ...membership };
    await save();
  }
  if (!flow.order) {
    if (!deposit && toUnits(await usdcBalance(key.publicKey())) < toUnits(amount)) throw new Error('Payee does not have enough USDC to withdraw.');
    flow.order = await anchor.start(values.only, amount);
    await save();
    console.log(`Saved anchor order: ${flow.order.id}`);
  }

  if (deposit) {
    const current = await anchor.transaction(flow.order.id);
    if (current.status === 'pending_user_transfer_start') {
      await anchor.simulateDeposit(flow.order.id, flow.order.quote.sell_amount);
    }
  } else if (!flow.payment?.result) {
    const order = flow.order;
    if (order.memo_type !== 'id' || !/^\d+$/.test(String(order.memo)) || !order.account_id?.startsWith('G')) {
      throw new Error('Withdrawal has no usable Stellar destination and memo.');
    }
    if (!flow.payment && Date.parse(order.quote.expires_at) <= Date.now()) {
      throw new Error(`Withdrawal ${order.id} quote expired before signing; no payment sent. Reconcile the saved order before opening another.`);
    }
    await journaled(flow, 'payment', save, onSigned => send(key, Operation.payment({
      destination: order.account_id, asset: USDC, amount: fromUnits(toUnits(order.quote.sell_amount)),
    }), { soroban: false, memo: Memo.id(String(order.memo)), label: 'Pay anchor with exact withdrawal memo', onSigned }));
  }

  const transaction = await anchor.wait(flow.order.id, { ensureTrustline: () => trustline(key) });
  flow.settlement = transaction;
  await save();
  if (deposit) {
    if (transaction.amount_out_asset && transaction.amount_out_asset !== STELLAR_USDC) throw new Error('Anchor paid an unexpected asset.');
    if (!transaction.stellar_transaction_id) throw new Error('Completed deposit has no Stellar settlement hash.');
    if (transaction.claimable_balance_id) {
      await journaled(flow, 'claim', save, onSigned => send(key, Operation.claimClaimableBalance({ balanceId: transaction.claimable_balance_id }), { soroban: false, label: 'Claim anchor deposit', onSigned }));
    }
    if (!flow.contributionAmount) {
      // These dedicated demo wallets contribute their entire USDC balance.
      const balance = await usdcBalance(key.publicKey());
      if (toUnits(balance) < toUnits(transaction.amount_out)) throw new Error('Deposit is not yet available in the member wallet. Resume this order.');
      flow.contributionAmount = balance;
      await save();
    }
    await journaled(flow, 'contribution', save, onSigned => call(key, treasury, 'contribute', [
      address(key.publicKey()), i128(toUnits(flow.contributionAmount)),
    ], { onSigned }));
    const remaining = await usdcBalance(key.publicKey());
    if (toUnits(remaining) !== 0n) throw new Error(`Member wallet still has ${remaining} USDC; reconcile before claiming completion.`);
  } else if (!transaction.external_transaction_id) {
    throw new Error('Completed withdrawal has no sandbox bank reference.');
  }
  const proof = {
    account: key.publicKey(), anchorId: transaction.id, status: transaction.status,
    quoteId: flow.order.quote.id, amountIn: transaction.amount_in, amountOut: transaction.amount_out,
    stellarHash: transaction.stellar_transaction_id ?? flow.payment?.result.hash,
    ...(deposit ? {
      treasury, ...flow.membership, contributionHash: flow.contribution.result.hash,
      contributionAmount: flow.contributionAmount, memberRemainingUSDC: await usdcBalance(key.publicKey()),
    } : {
      paymentHash: flow.payment.result.hash, bankReference: transaction.external_transaction_id,
      anchorAccount: flow.order.account_id, memo: String(flow.order.memo),
    }),
    bankSettlement: 'simulated', stellarNetwork: 'testnet',
  };
  await recordProof(deposit ? 'deposit' : 'withdrawal', proof);
  flow.completed = true;
  await save();
  console.log(`${deposit ? 'Deposit and contribution' : 'Withdrawal'} verified. Bank settlement is simulated; Stellar transfer is on testnet.`);
});
