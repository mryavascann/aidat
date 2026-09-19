import test from "node:test";
import assert from "node:assert/strict";
import {
  duesPeriod,
  duesPeriodRange,
  duesReport,
  canRefreshDuesQuote,
  type DuesPayment,
} from "../src/lib/dues.ts";

const config = {
  start_time: 1000n,
  start_ledger: 100,
  period_seconds: 2592000n,
  period_ledgers: 518400,
  dues_try: 20000n,
};
const payment = (amountTry: string, amountUsdc = "50000000"): DuesPayment => ({
  hash: "a".repeat(64),
  seat: 1,
  amountTry,
  amountUsdc,
  paidAt: 1100,
  method: "USDC",
});
test("cancelled unsigned quotes can refresh, but an uncertain signed contribution keeps its original quote", () => {
  const now = Date.UTC(2026, 8, 19);
  const expired = new Date(now - 1).toISOString();
  assert.equal(canRefreshDuesQuote(expired, false, now), true);
  assert.equal(canRefreshDuesQuote(expired, true, now), false);
  assert.equal(canRefreshDuesQuote(undefined, true, now), false);
  assert.equal(
    canRefreshDuesQuote(new Date(now + 180000).toISOString(), false, now),
    true,
  );
  assert.equal(
    canRefreshDuesQuote(new Date(now + 600000).toISOString(), false, now),
    false,
  );
});
test("dues accrue once per 30-day cycle, only after both clocks cross the boundary", () => {
  assert.equal(duesPeriod(config, 2593000, 518499), 0);
  assert.equal(duesPeriod(config, 2592999, 518500), 0);
  assert.equal(duesPeriod(config, 2593000, 518500), 1);
  assert.deepEqual(duesPeriodRange(config, 1), {
    start: 2593000,
    end: 5185000,
  });
});
test("partial contributions settle the oldest unpaid month and identify unpaid apartments", () => {
  const seats = [
    { id: 1, owner: "owner", paid: 50000000n },
    { id: 2, owner: "tenant's owner", paid: 0n },
  ];
  const previous = duesReport(config, seats, [payment("25000")], 1, 0);
  assert.equal(previous[0].status, "paid");
  const current = duesReport(config, seats, [payment("25000")], 1, 1);
  assert.equal(current[0].paid, 5000n);
  assert.equal(current[0].remaining, 15000n);
  assert.equal(current[0].arrears, 15000n);
  assert.equal(current[0].status, "partial");
  assert.equal(current[1].status, "unpaid");
  assert.equal(current[1].arrears, 40000n);
});
test("overpayment carries forward, and changing the owner does not erase apartment dues", () => {
  const [row] = duesReport(
    config,
    [{ id: 1, owner: "buyer", paid: 50000000n }],
    [payment("65000")],
    1,
    1,
  );
  assert.equal(row.status, "paid");
  assert.equal(row.advance, 25000n);
  const [next] = duesReport(
    config,
    [{ id: 1, owner: "buyer", paid: 50000000n }],
    [payment("65000")],
    2,
    2,
  );
  assert.equal(next.status, "paid");
  assert.equal(next.advance, 5000n);
});
test("unindexed or racing chain payments require review instead of claiming an apartment is unpaid", () => {
  assert.equal(
    duesReport(
      config,
      [{ id: 1, owner: "owner", paid: 50000000n }],
      [],
      0,
      0,
    )[0].status,
    "review",
  );
  assert.equal(
    duesReport(
      config,
      [{ id: 1, owner: "owner", paid: 0n }],
      [payment("20000")],
      0,
      0,
    )[0].status,
    "review",
  );
});
test("TRY credit is a recorded integer amount and never recalculated from a new exchange rate", () => {
  const [row] = duesReport(
    config,
    [{ id: 1, owner: "owner", paid: 100000000n }],
    [payment("20000"), { ...payment("25000"), hash: "b".repeat(64) }],
    1,
    1,
  );
  assert.equal(row.paid, 20000n);
  assert.equal(row.advance, 5000n);
});
