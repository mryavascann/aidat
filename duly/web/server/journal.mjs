// Testnet-only durable bank journal. AES-GCM ciphertext is split into Stellar
// account-data entries. A separate journal account prevents journal writes
// from consuming the escrow payment's sequence number. Raw IBANs stay private.
import {
  bankKey,
  derivedKey,
  funded,
  horizon,
  hash,
  NETWORK,
  Operation,
  seal,
  submit,
  TransactionBuilder,
  unseal,
} from "./runtime.mjs";
export const queueScope = (treasury, id) => `queue:${treasury}:${id}`;
export class JournalConflict extends Error {
  constructor() {
    super("Bank journal changed; resume its current reference.");
  }
}
const countOf = (account) =>
  Number(
    Buffer.from(account.data_attr["duly:count"] ?? "", "base64").toString() ||
      0,
  );
export async function readJournal(scope) {
  const key = derivedKey(scope);
  let account;
  try {
    account = await horizon.loadAccount(key.publicKey());
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
  const count = countOf(account);
  if (!count) return { key, version: account.sequenceNumber(), value: null };
  if (count > 70) throw new Error("Invalid bank journal size.");
  const chunks = Array.from({ length: count }, (_, i) =>
    Buffer.from(account.data_attr[`duly:${i}`] ?? "", "base64"),
  );
  return {
    key,
    version: account.sequenceNumber(),
    value: unseal(Buffer.concat(chunks).toString("base64url")),
  };
}
export async function writeJournal(scope, value, expected) {
  const key = derivedKey(scope);
  await funded(key);
  const account = await horizon.loadAccount(key.publicKey());
  if (expected && account.sequenceNumber() !== expected)
    throw new JournalConflict();
  const encrypted = Buffer.from(seal(value), "base64url"),
    count = Math.ceil(encrypted.length / 64);
  if (count > 70)
    throw new Error("Bank journal exceeds its testnet storage limit.");
  let builder = new TransactionBuilder(account, {
    networkPassphrase: NETWORK,
    fee: "10000",
  })
    .setTimeout(180)
    .addOperation(
      Operation.manageData({ name: "duly:count", value: String(count) }),
    );
  for (let i = 0; i < count; i++)
    builder = builder.addOperation(
      Operation.manageData({
        name: `duly:${i}`,
        value: encrypted.subarray(i * 64, (i + 1) * 64),
      }),
    );
  for (let i = count; i < countOf(account); i++)
    builder = builder.addOperation(
      Operation.manageData({ name: `duly:${i}`, value: null }),
    );
  const tx = builder.build();
  tx.sign(key);
  const result = await submit({
    envelope: tx.toXDR(),
    hash: Buffer.from(tx.hash()).toString("hex"),
  });
  if (result.pending) throw new JournalConflict();
  return readJournal(scope);
}
async function index(scope, enabled) {
  const key = bankKey(),
    name = `queue:${hash(scope).slice(0, 56)}`,
    value = enabled ? derivedKey(scope).publicKey() : null;
  // A failed sequence retry is safe here: it only assigns the same map entry.
  for (let i = 0; i < 3; i++) {
    const account = await horizon.loadAccount(key.publicKey());
    const prior = account.data_attr[name];
    if (
      (value === null && !prior) ||
      (prior && Buffer.from(prior, "base64").toString() === value)
    )
      return;
    const tx = new TransactionBuilder(account, {
      networkPassphrase: NETWORK,
      fee: "10000",
    })
      .addOperation(Operation.manageData({ name, value }))
      .setTimeout(180)
      .build();
    tx.sign(key);
    try {
      const result = await submit({
        envelope: tx.toXDR(),
        hash: Buffer.from(tx.hash()).toString("hex"),
      });
      if (!result.pending) return;
    } catch (error) {
      if (i === 2) throw error;
    }
  }
  throw new JournalConflict();
}
export const queueIndex = (scope) => index(scope, true);
export const removeIndex = (scope) => index(scope, false);
export async function queuedRoutes() {
  const account = await horizon.loadAccount(bankKey().publicKey());
  const ids = Object.entries(account.data_attr)
    .filter(([name]) => name.startsWith("queue:"))
    .map(([, data]) => Buffer.from(data, "base64").toString());
  const routes = [];
  for (const id of ids) {
    const record = await horizon.loadAccount(id),
      count = countOf(record);
    if (!count || count > 70) continue;
    const value = unseal(
      Buffer.concat(
        Array.from({ length: count }, (_, i) =>
          Buffer.from(record.data_attr[`duly:${i}`] ?? "", "base64"),
        ),
      ).toString("base64url"),
    );
    if (value.kind === "expense-queue")
      routes.push({ treasury: value.treasury, id: value.id });
  }
  return routes;
}
