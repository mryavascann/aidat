import assert from "node:assert/strict";
import { test } from "node:test";
import { demoFundingAmount, demoFundingPlan } from "../src/lib/demo-funding.ts";

const offer = (extra = {}) => ({
  source_asset_type: "native",
  source_amount: "19.0131426",
  destination_amount: "20.0000000",
  destination_asset_code: "USDC",
  destination_asset_issuer: "configured-issuer",
  path: [],
  ...extra,
});

test("demo funding tops up to 20 USDC without touching a funded wallet", () => {
  assert.equal(demoFundingAmount(0n), 200000000n);
  assert.equal(demoFundingAmount(125000000n), 75000000n);
  assert.equal(demoFundingAmount(200000000n), 0n);
  assert.equal(demoFundingAmount(500000000n), 0n);
});

test("funding pins the received amount and rounds a bounded XLM maximum upward", () => {
  assert.deepEqual(
    demoFundingPlan(200000000n, [offer()], "configured-issuer"),
    {
      amount: "20.0000000",
      sendMax: "19.9637998",
    },
  );
  assert.equal(
    demoFundingPlan(
      200000000n,
      [offer({ source_amount: "99" })],
      "configured-issuer",
    ).sendMax,
    "100.0000000",
  );
});

test("wrong assets, indirect routes and excessive test-XLM spending are refused", () => {
  for (const path of [
    offer({ destination_asset_issuer: "different-issuer" }),
    offer({ destination_asset_code: "OTHER" }),
    offer({ source_asset_type: "credit_alphanum4" }),
    offer({ destination_amount: "19" }),
    offer({ path: [{}] }),
    offer({ source_amount: "100.0000001" }),
  ])
    assert.throws(
      () => demoFundingPlan(200000000n, [path], "configured-issuer"),
      /demoFundingUnavailable/,
    );
  assert.throws(
    () => demoFundingPlan(200000001n, [offer()], "configured-issuer"),
    /demoFundingUnavailable/,
  );
  assert.throws(
    () => demoFundingPlan(0n, [], "configured-issuer"),
    /demoFundingUnavailable/,
  );
});

test("a cheaper valid direct route wins over an invalid or more expensive quote", () => {
  const plan = demoFundingPlan(
    200000000n,
    [
      offer({ source_amount: "25" }),
      offer(),
      offer({ source_amount: "1", destination_asset_issuer: "wrong" }),
    ],
    "configured-issuer",
  );
  assert.equal(plan.sendMax, "19.9637998");
});
