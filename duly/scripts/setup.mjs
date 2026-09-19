import { assertTestnet, horizon, keyAt, recordProof, trustline, usdcBalance } from './lib/soroban.mjs';

await assertTestnet();
const accounts = {};
for (const [role, file] of Object.entries({ admin: '.duly-admin-key', member: '.duly-testnet-key', payee: '.duly-payee-key' })) {
  const key = await keyAt(file, { create: true });
  const publicKey = key.publicKey();
  let fundingHash;
  try { await horizon.loadAccount(publicKey); }
  catch (error) {
    if (error.response?.status !== 404) throw error;
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Friendbot failed: ${response.status}`);
    fundingHash = (await response.json()).hash;
  }
  const trust = await trustline(key);
  const operations = await horizon.operations().forAccount(publicKey).order('asc').limit(200).call();
  fundingHash ??= operations.records.find(o => o.type === 'create_account' && o.account === publicKey)?.transaction_hash;
  const trustlineHash = trust?.hash ?? operations.records.find(o => o.type === 'change_trust' && o.asset_code === 'USDC')?.transaction_hash;
  accounts[role] = { publicKey, keyFile: file, ...(fundingHash && { fundingHash }), ...(trustlineHash && { trustlineHash }) };
  await recordProof('accounts', accounts);
  console.log(`${role}: ${publicKey}; USDC ${await usdcBalance(publicKey)}`);
}
await recordProof('accounts', accounts);
