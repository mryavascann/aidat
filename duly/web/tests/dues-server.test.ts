import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { xdr } from "@duly/stellar-sdk";
import { validateContribution, decodePayment } from "../server/dues.mjs";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/dues-receipt.json", import.meta.url),
    "utf8",
  ),
);
const result = () => ({
  status: fixture.status,
  createdAt: fixture.createdAt,
  events: {
    contractEventsXdr: [
      fixture.events.map((value: string) =>
        xdr.ContractEvent.fromXdr(value, "base64"),
      ),
    ],
  },
});
const expected = {
  treasury: "CCCIYRPSCGGPG5GYKATYGMJ6NJTGKZBHBK7HHOFBYJYJM2KBWXTWB7KJ",
  seat: 1,
  account: "GC6YV3UQ7G25SGZSJSHCEXCATUXTQ5UFOHLCRIFJADJJXWTDDMRRPYE4",
  amountUsdc: "40792181",
};
test("dues credit verifies the actual emitting treasury, apartment, payer and stroops", () => {
  assert.equal(
    validateContribution(result(), expected),
    Number(fixture.createdAt),
  );
  for (const mutation of [
    { seat: 2 },
    { amountUsdc: "40792182" },
    { account: "someone else" },
    { treasury: "another building" },
  ])
    assert.throws(() =>
      validateContribution(result(), { ...expected, ...mutation }),
    );
  assert.throws(() =>
    validateContribution({ ...result(), status: "FAILED" }, expected),
  );
});
test("bank transfers and duplicate contribution events cannot masquerade as one dues payment", () => {
  const r = result();
  const event = r.events.contractEventsXdr[0].at(-1)!;
  r.events.contractEventsXdr[0].push(event);
  assert.throws(() => validateContribution(r, expected), /unique/);
  assert.throws(
    () =>
      validateContribution(
        { ...result(), events: { contractEventsXdr: [] } },
        expected,
      ),
    /unique/,
  );
});
test("a frozen USDC rate cannot be attached to a payment from before or after its quote window", () => {
  const at = Number(fixture.createdAt);
  assert.equal(
    validateContribution(result(), {
      ...expected,
      createdAt: at - 10,
      expiresAt: at + 1,
    }),
    at,
  );
  assert.throws(() =>
    validateContribution(result(), {
      ...expected,
      createdAt: at + 100,
      expiresAt: at + 200,
    }),
  );
  assert.throws(() =>
    validateContribution(result(), {
      ...expected,
      createdAt: at - 100,
      expiresAt: at - 1,
    }),
  );
});
test("corrupt ledger data fails closed instead of turning missing history into unpaid debt", () => {
  const id = "a".repeat(64);
  assert.equal(
    decodePayment(id, '[1,"20000","40792181",1789847007,0]').method,
    "TRY",
  );
  for (const row of [
    '[0,"20000","4",1,0]',
    '[1,"-20000","4",1,0]',
    '[1,"20000","4",1,2]',
    "[]",
  ])
    assert.throws(() => decodePayment(id, row));
});
