// Public, read-only verification. This script never reads a key or signs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Address, xdr } from "@stellar/stellar-sdk";
import {
  address,
  assertTestnet,
  horizon,
  i128,
  readAs,
  server,
  u32,
  USDC_ISSUER,
} from "./lib/soroban.mjs";
import { toUnits } from "./lib/amounts.mjs";
const json = async (name) =>
  JSON.parse(
    await readFile(new URL(`../deployments/${name}`, import.meta.url), "utf8"),
  );
const deployment = await json("building-testnet-v3.json");
const proof = await json(process.argv[2] ?? "building-browser-testnet-v3.json");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const hex = (value) => Buffer.from(value).toString("hex");
await assertTestnet();
async function codeHash(id) {
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
  const result = await server.getLedgerEntries(key);
  assert(result.entries[0], `Missing contract ${id}`);
  return hex(
    result.entries[0].val.contractData.val.instance.executable.wasmHash.value,
  );
}
for (const [name, expected] of [
  ["duly_building_v3.wasm", deployment.wasmHash],
  ["duly_building_demo_v3.wasm", deployment.demoWasmHash],
  ["duly_factory_v3.wasm", deployment.factoryWasmHash],
])
  assert.equal(
    digest(await readFile(new URL(`../deployments/${name}`, import.meta.url))),
    expected,
  );
for (const [id, expected] of [
  [deployment.treasury, deployment.wasmHash],
  [deployment.factory, deployment.factoryWasmHash],
  [proof.solo.treasury, deployment.demoWasmHash],
  [proof.passkey.account, deployment.accountWasmHash],
  [deployment.webauthnVerifier, deployment.verifierHash],
])
  assert.equal(await codeHash(id), expected);
const factory = await readAs(deployment.factory, "config");
assert.equal(hex(factory.wasm), deployment.wasmHash);
assert.equal(hex(factory.demo_wasm), deployment.demoWasmHash);
for (const key of ["bank", "token", "vault"])
  assert.equal(factory[key], deployment[key]);
for (const [id, demo] of [
  [deployment.treasury, false],
  [proof.solo.treasury, true],
  [proof.passkey.treasury, false],
]) {
  const cfg = await readAs(id, "config");
  assert.equal(cfg.demo, demo);
  for (const key of ["bank", "token", "vault"])
    assert.equal(cfg[key], deployment[key]);
  assert.equal(cfg.objection_seconds, demo ? 20n : 259200n);
  assert.equal(cfg.recovery_seconds, demo ? 60n : 604800n);
  assert.equal(cfg.period_seconds, demo ? 600n : 2592000n);
  assert.equal((await readAs(id, "seats")).length, cfg.seat_count);
}
assert.equal(
  (await readAs(proof.passkey.treasury, "config")).manager,
  proof.passkey.account,
);
assert.deepEqual(
  await readAs(proof.passkey.treasury, "motion_tally", [u32(1)]),
  [1, 0],
);
assert((await readAs(proof.passkey.treasury, "contribution", [u32(1)])) > 0n);
const hashes = new Set(Object.values(deployment.receipts));
for (const flow of proof.solo.receipts) hashes.add(flow.receipt);
hashes.add(proof.closedBrowserQueue.receipt);
hashes.add(proof.closedBrowserQueue.proposalHash);
for (const hash of hashes)
  assert.equal(
    (await horizon.transactions().transaction(hash).call()).successful,
    true,
  );
for (const [treasury, id, receipt] of [
  [
    proof.solo.treasury,
    1,
    proof.solo.receipts.find((r) => r.kind === "withdraw"),
  ],
  [
    proof.closedBrowserQueue.treasury,
    proof.closedBrowserQueue.expense,
    proof.closedBrowserQueue,
  ],
]) {
  const expense = await readAs(treasury, "expense", [u32(id)]);
  assert.equal(expense.status[0], "Settled");
  assert.equal(expense.amount_try, toUnits(receipt.amountTry, 2));
  assert.equal(expense.quote[0], "Prepared");
  const quote = expense.quote[1];
  assert.equal(quote.amount_usdc, toUnits(receipt.amountUsdc));
  assert(expense.bank_receipt);
  const tx = await horizon.transactions().transaction(receipt.receipt).call();
  assert.equal(tx.memo_type, "id");
  const ops = await horizon.operations().forTransaction(receipt.receipt).call();
  assert(
    ops.records.some(
      (op) =>
        op.type === "payment" &&
        op.from === quote.account &&
        op.asset_code === "USDC" &&
        op.asset_issuer === USDC_ISSUER &&
        toUnits(op.amount) === quote.amount_usdc,
    ),
  );
}
const incoming = proof.solo.receipts.find((r) => r.kind === "deposit");
const outgoing = proof.solo.receipts.find((r) => r.kind === "withdraw");
const shares = await readAs(deployment.vault, "balance", [
  address(proof.solo.treasury),
]);
const backing = (
  await readAs(deployment.vault, "get_asset_amounts_per_shares", [i128(shares)])
)[0];
const extraQueuePayment =
  proof.closedBrowserQueue.treasury === proof.solo.treasury
    ? toUnits(proof.closedBrowserQueue.amountUsdc)
    : 0n;
assert.equal(
  backing,
  toUnits(incoming.amountUsdc) -
    toUnits(outgoing.amountUsdc) -
    extraQueuePayment,
);
assert.equal(await readAs(proof.solo.treasury, "balance"), backing);
assert.equal(await readAs(proof.solo.treasury, "liquid_balance"), 0n);
console.log(
  `V3 verified: ${hashes.size} successful receipts; exact WASM, immutable factory, normal/demo clocks, passkey governance, settled bank payments and reserve backing.`,
);
