import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnchorClient } from '../lib/anchor.mjs';

test('anchor observer persists completed and failed states before returning or throwing', async () => {
  for (const status of ['completed', 'expired', 'pending_customer_info_update', 'unexpected_status']) {
    const anchor = new AnchorClient({});
    anchor.transaction = async () => ({ id: 'saved-order', status });
    const observed = [];
    const promise = anchor.wait('saved-order', { onTransaction: tx => observed.push(tx) });
    if (status === 'completed') assert.equal((await promise).status, status);
    else await assert.rejects(promise);
    assert.deepEqual(observed, [{ id: 'saved-order', status }]);
  }
});
test('persistence failure stops polling instead of losing the recovery state', async () => {
  const anchor = new AnchorClient({});
  let requests = 0;
  anchor.transaction = async () => { requests++; return { id: 'saved-order', status: 'pending_anchor' }; };
  await assert.rejects(anchor.wait('saved-order', { onTransaction: () => { throw new Error('storage unavailable'); } }), /storage unavailable/);
  assert.equal(requests, 1);
});
