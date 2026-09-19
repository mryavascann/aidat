import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  Account, Address, Contract, Horizon, Keypair, Operation,
  TransactionBuilder, nativeToScVal, rpc, scValToNative,
} from '@stellar/stellar-sdk';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
import { NETWORK, RPC_URL, HORIZON_URL, USDC_ISSUER, USDC } from './config.mjs';
export { NETWORK, RPC_URL, HORIZON_URL, ANCHOR, USDC_ISSUER, USDC, TOKEN } from './config.mjs';
export const server = new rpc.Server(RPC_URL);
export const horizon = new Horizon.Server(HORIZON_URL);
export const address = value => new Address(value).toScVal();
export const i128 = value => nativeToScVal(BigInt(value), { type: 'i128' });
export const u32 = value => nativeToScVal(value, { type: 'u32' });
export const string = value => nativeToScVal(value, { type: 'string' });

// The only key creation path is setup. An absent key elsewhere is an error, not
// an invitation to silently replace the identity that controls a treasury.
export async function keyAt(file, { create = false } = {}) {
  const path = resolve(ROOT, file);
  try {
    const key = Keypair.fromSecret((await readFile(path, 'utf8')).trim());
    await chmod(path, 0o600);
    return key;
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    const key = Keypair.random();
    await writeFile(path, `${key.secret()}\n`, { mode: 0o600, flag: 'wx' });
    return key;
  }
}

export async function assertTestnet() {
  const network = await server.getNetwork();
  if (network.passphrase !== NETWORK) throw new Error('Refusing to transact outside Stellar testnet.');
}

export async function send(key, operation, { soroban = true, memo, label = 'transaction', onSigned } = {}) {
  const account = await horizon.loadAccount(key.publicKey());
  let builder = new TransactionBuilder(account, { fee: '10000', networkPassphrase: NETWORK })
    .addOperation(operation).setTimeout(180);
  if (memo) builder = builder.addMemo(memo);
  let tx = builder.build();
  if (soroban) tx = await server.prepareTransaction(tx);
  tx.sign(key);
  const hash = Buffer.from(tx.hash()).toString('hex');
  // Journaling before submission lets a caller reconcile an interrupted payment.
  if (onSigned) await onSigned({ hash, envelope: tx.toXDR() });
  return submitAndWait(tx, label);
}

export async function resumeTransaction(saved, label) {
  const tx = TransactionBuilder.fromXDR(saved.envelope, NETWORK);
  if (Buffer.from(tx.hash()).toString('hex') !== saved.hash) throw new Error('Saved transaction hash mismatch.');
  return submitAndWait(tx, label);
}

async function submitAndWait(tx, label) {
  const hash = Buffer.from(tx.hash()).toString('hex');
  const prior = await server.getTransaction(hash);
  if (prior.status === rpc.Api.GetTransactionStatus.SUCCESS) return confirmed(prior, hash, label);
  if (prior.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error(`${label} previously failed (${hash}); no second payment was sent.`);
  const submitted = await server.sendTransaction(tx);
  if (!['PENDING', 'DUPLICATE', 'TRY_AGAIN_LATER'].includes(submitted.status)) {
    throw new Error(`${label} rejected (${hash}): ${submitted.errorResult?.toXdr('base64') ?? submitted.status}`);
  }
  if (submitted.status === 'TRY_AGAIN_LATER') {
    throw new Error(`${label} was not accepted yet (${hash}); reconcile this hash before retrying.`);
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await server.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return confirmed(result, hash, label);
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`${label} failed (${hash}): ${result.resultXdr?.toXdr('base64') ?? 'unknown'}`);
    }
    await delay(2000);
  }
  throw new Error(`${label} confirmation timed out (${hash}); reconcile this hash before retrying.`);
}

function confirmed(result, hash, label) {
  const value = result.returnValue ? scValToNative(result.returnValue) : undefined;
  console.log(`${label}: https://stellar.expert/explorer/testnet/tx/${hash}`);
  return { hash, value, ledger: result.ledger };
}

export function call(key, contractId, method, args = [], options = {}) {
  return send(key, new Contract(contractId).call(method, ...args), { label: method, ...options });
}

export async function readAs(contractId, method, args = []) {
  // A simulation has no signature, sequence consumption or need for funding.
  const source = new Account(USDC_ISSUER, '0');
  const tx = new TransactionBuilder(source, { fee: '100', networkPassphrase: NETWORK })
    .addOperation(new Contract(contractId).call(method, ...args)).setTimeout(30).build();
  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result) {
    throw new Error(`Read ${method} failed: ${result.error ?? 'no return value'}`);
  }
  return scValToNative(result.result.retval);
}

export async function trustline(key) {
  const account = await horizon.loadAccount(key.publicKey());
  if (account.balances.some(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER)) return null;
  return send(key, Operation.changeTrust({ asset: USDC }), { soroban: false, label: 'USDC trustline' });
}

export async function usdcBalance(publicKey) {
  const account = await horizon.loadAccount(publicKey);
  return account.balances.find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER)?.balance ?? '0.0000000';
}

export async function contractId() {
  return (await readFile(resolve(ROOT, '.duly-contract-id'), 'utf8')).trim();
}

export const json = value => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);

export async function recordProof(section, value) {
  const path = resolve(ROOT, 'deployments/testnet.json');
  let proof;
  try { proof = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; proof = { network: NETWORK }; }
  proof[section] = value;
  proof.updatedAt = new Date().toISOString();
  await mkdir(resolve(ROOT, 'deployments'), { recursive: true });
  await writeFile(path, `${json(proof)}\n`);
}
