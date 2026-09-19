import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journaled } from '../lib/state.mjs';

test('signed transaction is saved before submission and confirmed result after', async () => {
  const flow = {};
  const snapshots = [];
  const save = async () => snapshots.push(structuredClone(flow));
  const result = await journaled(flow, 'payment', save, async onSigned => {
    await onSigned({ hash: 'hash', envelope: 'signed-envelope' });
    assert.equal(snapshots[0].payment.envelope, 'signed-envelope');
    assert.equal(snapshots[0].payment.result, undefined);
    return { hash: 'hash', ledger: 123 };
  });
  assert.equal(result.ledger, 123);
  assert.equal(snapshots[1].payment.result.ledger, 123);
});

test('restart resumes the saved signed transaction instead of creating a payment', async () => {
  const signed = { hash: 'hash', envelope: 'signed-envelope' };
  const flow = { payment: signed };
  let saves = 0;
  const result = await journaled(flow, 'payment', async () => { saves++; },
    async () => assert.fail('must not create a second payment'),
    async (saved, step) => {
      assert.deepEqual(saved, signed);
      assert.equal(step, 'payment');
      return { hash: saved.hash, ledger: 124 };
    });
  assert.equal(result.ledger, 124);
  assert.equal(saves, 1);
});

test('confirmed step is not submitted again after restart', async () => {
  const confirmed = { hash: 'hash', ledger: 125 };
  const flow = { payment: { result: confirmed } };
  const never = async () => assert.fail('completed payment should do no work');
  assert.equal(await journaled(flow, 'payment', never, never, never), confirmed);
});

test('uncertain submission retains the signed envelope for recovery', async () => {
  const flow = {};
  await assert.rejects(journaled(flow, 'payment', async () => {}, async onSigned => {
    await onSigned({ hash: 'hash', envelope: 'signed-envelope' });
    throw new Error('connection lost');
  }), /connection lost/);
  assert.equal(flow.payment.envelope, 'signed-envelope');
  assert.equal(flow.payment.result, undefined);
});
