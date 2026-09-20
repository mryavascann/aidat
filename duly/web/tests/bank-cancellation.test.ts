import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  bankRecord,
  bankRecords,
  blocksNewContribution,
  canStopDeposit,
  reactivateDeposit,
  saveBank,
  stopDeposit,
  type BankRecord,
} from "../src/lib/bank-records.ts";
import { save } from "../src/lib/storage.ts";
import { dispatchSavedPayment, queueView } from "../server/bank.mjs";

const deposit = (extra: Partial<BankRecord> = {}): BankRecord => ({
  key: "original-order",
  kind: "deposit",
  treasury: "building",
  account: "resident",
  seat: 1,
  saved: "sealed-original-bank-route",
  phase: "processing",
  bankStatus: "pending_anchor",
  anchorId: "original-anchor-id",
  amountTry: "200",
  amountUsdc: "4.1",
  ...extra,
});
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

test("stopping unsigned bank dues unlocks the form without deleting or cancelling the bank record", () => {
  const original = saveBank(deposit());
  assert(blocksNewContribution(original));
  const stopped = stopDeposit(original, "resident");
  assert(stopped.stoppedAt);
  assert(!blocksNewContribution(stopped));
  const { stoppedAt, ...retained } = stopped;
  const { stoppedAt: previous, ...expected } = original;
  assert.deepEqual(retained, expected);
  assert.equal(bankRecords("building", "resident").length, 1);
  assert.equal(bankRecord(original.key)?.bankStatus, "pending_anchor");
  assert.equal(stopDeposit(original, "resident").stoppedAt, stoppedAt);
});

test("a bank response arriving after cancellation keeps the stop and saves the recovery receipt", () => {
  const inFlight = saveBank(deposit());
  const stopped = stopDeposit(inFlight, "resident");
  const response = saveBank({
    ...inFlight,
    phase: "contribute",
    saved: "updated-sealed-route-with-signed-envelope",
    receipt: "bank-transfer-receipt",
  });
  assert.equal(response.stoppedAt, stopped.stoppedAt);
  assert.equal(response.phase, "contribute");
  assert.equal(response.receipt, "bank-transfer-receipt");
  assert(!blocksNewContribution(response));
  assert(!canStopDeposit(response));
});

test("only an explicit resume reactivates the original payment, never a replacement", () => {
  const original = saveBank(deposit());
  stopDeposit(original, "resident");
  const resumed = reactivateDeposit(original, "resident");
  assert(!resumed.stoppedAt);
  assert(blocksNewContribution(resumed));
  assert.equal(resumed.key, original.key);
  assert.equal(resumed.saved, original.saved);
  assert.equal(resumed.anchorId, original.anchorId);
  assert.equal(bankRecords("building", "resident").length, 1);
});

test("resuming a stopped payment cannot overlap another active dues payment", () => {
  const original = saveBank(deposit());
  stopDeposit(original, "resident");
  saveBank(deposit({ key: "other-payment", kind: "usdc", phase: "quoted" }));
  assert.throws(
    () => reactivateDeposit(original, "resident"),
    /otherDuesPending/,
  );
  assert(bankRecord(original.key)?.stoppedAt);
});

test("signed, uncertain, indexing and completed payments cannot be labelled cancelled", () => {
  for (const phase of ["contributing", "recording-dues", "complete"])
    assert(!canStopDeposit(deposit({ phase })));
  assert(!canStopDeposit(deposit({ kind: "withdraw" })));
  assert(!canStopDeposit(deposit({ kind: "usdc" })));
  const original = saveBank(deposit());
  // Protect old browser records that predate the contributing phase too.
  save("tx:resident:v3:deposit:original-order", { hash: "submitted" });
  assert.throws(
    () => stopDeposit(original, "resident"),
    /duesAlreadySubmitted/,
  );
  save("tx:resident:v3:deposit:original-order", null);
  save("v3:passkey:resident:deposit:original-order", { auth: "signed" });
  assert.throws(
    () => stopDeposit(original, "resident"),
    /duesAlreadySubmitted/,
  );
  assert(!bankRecord(original.key)?.stoppedAt);
});

test("a stale screen cannot cancel a contribution that has since started signing", () => {
  const stale = saveBank(deposit({ phase: "contribute" }));
  saveBank({ ...stale, phase: "contributing" });
  assert.throws(() => stopDeposit(stale, "resident"), /duesAlreadySubmitted/);
  assert.equal(bankRecord(stale.key)?.phase, "contributing");
});

test("stopping and resuming require the account that started the payment", () => {
  const original = saveBank(deposit());
  assert.throws(
    () => stopDeposit(original, "another-resident"),
    /permissionDenied/,
  );
  stopDeposit(original, "resident");
  assert.throws(
    () => reactivateDeposit(original, "another-resident"),
    /permissionDenied/,
  );
  assert.equal(bankRecords("other-building", "resident").length, 0);
});

test("a cancelled expense stops its queue even when a prepared bank record remains", () => {
  const view = queueView({
    treasury: "building",
    id: 3,
    phase: "cancelled",
    record: {
      phase: "attested",
      receipt: "original-receipt",
      saved: "private",
    },
  });
  assert.equal(view.phase, "cancelled");
  assert.equal(view.receipt, "original-receipt");
  assert.equal(view.saved, "");
});

test("checking a stopped bank payment only dispatches a status read", async () => {
  const calls: string[] = [];
  const operations = {
    inspectDeposit: async () => {
      calls.push("read");
      return { bankStatus: "pending_anchor" };
    },
    resumeDeposit: async () => {
      calls.push("transfer");
    },
    resumeWithdrawal: async () => {
      calls.push("withdraw");
    },
  };
  assert.deepEqual(
    await dispatchSavedPayment(
      { version: 3, kind: "deposit" },
      "status",
      operations,
    ),
    { bankStatus: "pending_anchor" },
  );
  assert.deepEqual(calls, ["read"]);
});

test("unknown cancellation actions can never accidentally start a bank transfer", async () => {
  const unexpected = async () => {
    assert.fail("No bank operation may run");
  };
  const operations = {
    inspectDeposit: unexpected,
    resumeDeposit: unexpected,
    resumeWithdrawal: unexpected,
  };
  for (const kind of ["deposit", "withdraw", "unknown"])
    for (const action of ["cancel", "delete", "", undefined])
      await assert.rejects(
        () => dispatchSavedPayment({ version: 3, kind }, action, operations),
        /Unsupported bank action/,
      );
});
