// Read-only public evidence verification: no private keys, signing or writes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertNetwork,
  horizon,
  read,
  server,
  uint,
  wasmHash,
} from "../web/server/runtime.mjs";
import { decodePayment, validateContribution } from "../web/server/dues.mjs";
const proof = JSON.parse(
  await readFile(
    new URL("../deployments/building-dues-testnet-v3.json", import.meta.url),
    "utf8",
  ),
);
const manifest = JSON.parse(
  await readFile(
    new URL("../web/src/building-deployment.json", import.meta.url),
    "utf8",
  ),
);
await assertNetwork();
let count = 0;
for (const [name, scenario] of Object.entries(proof.scenarios)) {
  const config = await read(scenario.treasury, "config");
  assert.equal(
    await wasmHash(scenario.treasury),
    config.demo ? manifest.demoWasmHash : manifest.wasmHash,
  );
  for (const key of ["bank", "token", "vault"])
    assert.equal(config[key], manifest[key]);
  assert.equal(config.period_seconds, config.demo ? 600n : 2592000n);
  const index = await horizon.loadAccount(scenario.index);
  const decode = (value) => Buffer.from(value, "base64").toString();
  assert.equal(decode(index.data_attr["duly:building"]), scenario.treasury);
  assert.equal(decode(index.data_attr["duly:bank"]), manifest.bank);
  const totals = new Map();
  for (const payment of scenario.payments) {
    assert.deepEqual(
      decodePayment(payment.hash, decode(index.data_attr[payment.hash])),
      payment,
    );
    assert.equal(
      (await horizon.transactions().transaction(payment.hash).call())
        .successful,
      true,
    );
    const result = await server.getTransaction(payment.hash);
    if (result.status === "NOT_FOUND")
      throw new Error(
        `RPC event history expired for ${payment.hash}; retained index and Horizon receipt exist, but this run cannot recheck the contribution event.`,
      );
    assert.equal(
      validateContribution(result, {
        treasury: scenario.treasury,
        account: scenario.account ?? config.manager,
        seat: payment.seat,
        amountUsdc: payment.amountUsdc,
      }),
      payment.paidAt,
    );
    totals.set(
      payment.seat,
      (totals.get(payment.seat) ?? 0n) + BigInt(payment.amountUsdc),
    );
    count++;
  }
  for (const [seat, total] of totals)
    assert(
      (await read(scenario.treasury, "contribution", [uint(seat)])) >= total,
    );
  console.log(
    `${name}: verified ${scenario.payments.length} exact contribution receipts and durable TRY credits.`,
  );
}
console.log(
  `Dues verified: ${count} receipts, normal/demo clocks, pinned building code and public index records. FX credits remain trusted adapter attestations.`,
);
