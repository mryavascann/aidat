// Export only public evidence from the private Playwright recovery file.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Keypair } from '@stellar/stellar-sdk';
import { NETWORK } from './lib/config.mjs';

const state = JSON.parse(await readFile(new URL('../web/test-results/browser-state.json', import.meta.url), 'utf8'));
const origin = state.origins.find(item => item.localStorage.some(entry => entry.name === 'duly:demo'));
assert(origin, 'No completed browser demo found.');
const records = new Map(origin.localStorage.filter(entry => entry.name.startsWith('duly:')).map(entry => [entry.name, JSON.parse(entry.value)]));
const demo = records.get('duly:demo');
assert(demo?.ready && demo.treasury, 'Demo setup is incomplete.');
const deployment = JSON.parse(await readFile(new URL('../web/src/deployment.json', import.meta.url), 'utf8'));
const steps = new Set(['trustline', 'create', 'member', 'contribution', 'propose', 'approve', 'execute', 'withdraw', 'invite', 'join']);
const transactions = [...records].filter(([key, value]) => key.startsWith('duly:tx:') && value?.result).map(([key, value]) => ({
  step: key.split(':').find(part => steps.has(part)), account: key.split(':')[2], hash: value.result.hash, ledger: value.result.ledger,
}));
const flows = [...records].filter(([key, value]) => key.startsWith('duly:bank:') && value?.treasury === demo.treasury).map(([, flow]) => {
  assert(flow.complete && flow.settlement?.status === 'completed', 'Bank flow is incomplete.');
  return {
    kind: flow.kind, account: flow.account, anchorId: flow.order.id, status: flow.settlement.status,
    amountIn: flow.settlement.amount_in, amountOut: flow.settlement.amount_out, receipt: flow.receipt,
    settlementHash: flow.settlement.stellar_transaction_id, bankReference: flow.settlement.external_transaction_id,
    ...(flow.kind === 'withdraw' ? { destination: flow.order.account_id, memo: String(flow.order.memo) } : {}),
  };
});
assert(flows.some(flow => flow.kind === 'deposit') && flows.some(flow => flow.kind === 'withdraw'));
const proof = {
  network: NETWORK, capturedAt: new Date().toISOString(), treasury: demo.treasury, vault: deployment.vault,
  accounts: Object.fromEntries(Object.entries(demo.secrets).map(([role, secret]) => [role, Keypair.fromSecret(secret).publicKey()])),
  transactions, flows, bankSettlement: 'simulated', externalExtensionSigning: 'not exercised',
};
const output = JSON.stringify(proof, null, 2) + '\n';
assert(!/\bS[A-Z2-7]{55}\b/.test(output), 'Secret-shaped data in public export.');
await writeFile(new URL('../deployments/browser-testnet-guided.json', import.meta.url), output);
console.log('Public evidence exported to deployments/browser-testnet-guided.json; run npm run verify:guided to verify it.');
