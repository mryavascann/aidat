import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnchorClient, STELLAR_USDC } from '../lib/anchor.mjs';

function sandbox(limits) {
  const anchor = new AnchorClient({ publicKey: () => 'test-account' });
  anchor.info = { deposit: { USDC: { enabled: true } }, withdraw: { USDC: { enabled: true } } };
  anchor.health = { limits };
  anchor.toml = { ANCHOR_QUOTE_SERVER: 'https://anchor.test/sep38', TRANSFER_SERVER: 'https://anchor.test/sep6' };
  const requests = [];
  anchor.request = async (url, options) => {
    requests.push(String(url));
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body);
      assert([body.sell_asset, body.buy_asset].includes(STELLAR_USDC));
      return { ...body, id: 'quote-1', expires_at: new Date(Date.now() + 60000).toISOString() };
    }
    return { id: 'order-1' };
  };
  return { anchor, requests };
}

test('missing or null sandbox limits still allow valid deposit and withdrawal quotes', async () => {
  for (const limits of [undefined, null, {}, { min_onramp_try: null, max_onramp_try: null, min_offramp_usdc: null }]) {
    for (const [kind, amount] of [['deposit', '200.00'], ['withdraw', '2.0000000']]) {
      const { anchor, requests } = sandbox(limits);
      const order = await anchor.start(kind, amount);
      assert.equal(order.id, 'order-1');
      assert.equal(order.quote.sell_amount, amount);
      assert.equal(requests.length, 2);
    }
  }
});

test('fallback limits reject out-of-range values before creating an anchor order', async () => {
  for (const [kind, amount] of [['deposit', '49.99'], ['deposit', '3000.01'], ['withdraw', '0.9999999'], ['withdraw', '0']]) {
    const { anchor, requests } = sandbox(null);
    await assert.rejects(anchor.start(kind, amount));
    assert.equal(requests.length, 0);
  }
  for (const [kind, amount] of [['deposit', '50.00'], ['deposit', '3000.00'], ['withdraw', '1.0000000']]) {
    assert.equal((await sandbox(null).anchor.start(kind, amount)).id, 'order-1');
  }
});

test('published numeric and decimal-string limits override the fallback', async () => {
  for (const limits of [
    { min_onramp_try: 100, max_onramp_try: 2500, min_offramp_usdc: 2 },
    { min_onramp_try: '100.00', max_onramp_try: '2500.00', min_offramp_usdc: '2.0000000' },
  ]) {
    for (const [kind, amount] of [['deposit', '99.99'], ['deposit', '2500.01'], ['withdraw', '1.9999999']]) {
      const { anchor, requests } = sandbox(limits);
      await assert.rejects(anchor.start(kind, amount));
      assert.equal(requests.length, 0);
    }
    assert.equal((await sandbox(limits).anchor.start('deposit', '100.00')).id, 'order-1');
    assert.equal((await sandbox(limits).anchor.start('withdraw', '2.0000000')).id, 'order-1');
  }
});

test('malformed published limits fail closed instead of becoming fallback limits', async () => {
  for (const value of ['', 'invalid', '-1', '1.001', Infinity, NaN]) {
    const { anchor, requests } = sandbox({ min_onramp_try: value });
    await assert.rejects(anchor.start('deposit', '200.00'));
    assert.equal(requests.length, 0);
  }
});
