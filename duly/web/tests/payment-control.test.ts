import assert from "node:assert/strict";
import { test } from "node:test";
import { createPaymentControl } from "../src/lib/payment-control.ts";

test("repeated stop clicks share one cancellation and wait for its outcome", async () => {
  const control = createPaymentControl<string>();
  let finish!: (value: string) => void;
  let calls = 0;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const stop = () => {
    calls++;
    return pending;
  };
  assert.equal(control.stopped, false);
  control.requestStop(stop);
  control.requestStop(stop);
  assert.equal(control.stopped, true);
  let settled = false;
  const result = control.finish().then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(settled, false);
  finish("cancelled");
  assert.equal(await result, "cancelled");
});

test("an early cancellation failure is retained until the active bank request finishes", async () => {
  const control = createPaymentControl<string>();
  const failure = new Error("Cancellation was not signed");
  control.requestStop(async () => {
    throw failure;
  });
  // A rejected stop must not produce an unhandled rejection while bank I/O runs.
  await new Promise((resolve) => setTimeout(resolve, 20));
  await assert.rejects(control.finish(), (error) => error === failure);
});
