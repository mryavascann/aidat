import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  bankFlow,
  bankHistory,
  bankPhase,
  bankStep,
  saveBank,
  type BankFlow,
} from "../src/features/banking/model.ts";

const now = Date.parse("2026-09-19T12:00:00Z");
function order(overrides: Partial<BankFlow> = {}): BankFlow {
  return {
    kind: "deposit",
    account: "resident",
    treasury: "community",
    amount: "200",
    createdAt: "2026-09-19T11:00:00Z",
    order: { id: "order-1", quote: { expires_at: "2026-09-19T12:01:00Z" } },
    ...overrides,
  };
}
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  });
});
test("quote expiry changes at the exact boundary without declaring a payment failed", () => {
  assert.equal(bankPhase(order(), now), "ready");
  assert.equal(bankPhase(order(), now + 60000), "expired");
  assert.equal(
    bankPhase(order({ submittedAt: new Date(now).toISOString() }), now + 60000),
    "processing",
  );
});
test("settled deposit still needs the treasury contribution, even after quote expiry", () => {
  const flow = order({
    settlement: { status: "completed", stellar_transaction_id: "proof" },
    anchorStatus: "completed",
  });
  assert.equal(bankPhase(flow, now + 60000), "contribute");
  assert.equal(bankStep(flow), 2);
  assert.equal(bankPhase({ ...flow, complete: true }, now + 60000), "complete");
  assert.equal(bankStep({ ...flow, complete: true }), 3);
});
test("withdrawal receipt advances to bank settlement and cannot imply bank completion", () => {
  const flow = order({ kind: "withdraw", receipt: "confirmed-stellar-hash" });
  assert.equal(bankPhase(flow, now + 60000), "processing");
  assert.equal(bankStep(flow), 2);
});
test("terminal, action-required and unknown anchor statuses never offer a fresh transfer", () => {
  for (const status of [
    "error",
    "refunded",
    "no_market",
    "too_small",
    "too_large",
    "pending_customer_info_update",
    "pending_transaction_info_update",
    "on_hold",
    "incomplete",
    "new_unrecognized_status",
  ])
    assert.equal(
      bankPhase(order({ anchorStatus: status }), now),
      "attention",
      status,
    );
  assert.equal(bankPhase(order({ anchorStatus: "expired" }), now), "expired");
});
test("bank processing and trustline states remain resumable", () => {
  for (const status of [
    "pending_external",
    "pending_anchor",
    "pending_stellar",
    "pending_trust",
  ])
    assert.equal(
      bankPhase(order({ anchorStatus: status }), now + 60000),
      "processing",
      status,
    );
});
test("invalid expiry requires checking the order", () => {
  assert.equal(
    bankPhase(
      order({ order: { id: "bad", quote: { expires_at: "invalid" } } }),
      now,
    ),
    "attention",
  );
});
test("legacy saved orders migrate without losing receipts when a new order starts", () => {
  const old = order({ complete: true, receipt: "confirmed" });
  localStorage.setItem(
    "duly:bank:community:resident:deposit",
    JSON.stringify(old),
  );
  assert.equal(
    bankFlow("resident", "community", "deposit")?.receipt,
    "confirmed",
  );
  const next = order({
    createdAt: "2026-09-19T12:00:00Z",
    order: { ...old.order, id: "order-2" },
  });
  saveBank(next);
  assert.deepEqual(
    bankHistory("resident", "community").map((flow) => flow.order.id),
    ["order-2", "order-1"],
  );
  assert.equal(bankHistory("resident", "community")[1].receipt, "confirmed");
});
test("history updates an order once and survives an older legacy mirror", () => {
  const old = order();
  saveBank(old);
  saveBank({ ...old, complete: true, receipt: "confirmed" });
  localStorage.setItem(
    "duly:bank:community:resident:deposit",
    JSON.stringify(old),
  );
  assert.equal(bankHistory("resident", "community").length, 1);
  assert.equal(bankFlow("resident", "community", "deposit")?.complete, true);
});
test("history stays scoped to both wallet and treasury", () => {
  saveBank(order());
  assert.deepEqual(bankHistory("other-resident", "community"), []);
  assert.deepEqual(bankHistory("resident", "other-community"), []);
  assert.deepEqual(bankHistory("", "community"), []);
});
test("an older unfinished intent takes priority over completed history", () => {
  saveBank(order());
  saveBank(
    order({
      complete: true,
      createdAt: "2026-09-19T13:00:00Z",
      order: { id: "later", quote: {} },
    }),
  );
  assert.equal(
    bankFlow("resident", "community", "deposit")?.order.id,
    "order-1",
  );
});
