import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUnits, fromUnits } from '../lib/amounts.mjs';

test('amounts preserve a single stroop above the JS integer precision limit', () => {
  assert.equal(toUnits('900719925.4740993'), 9007199254740993n);
  assert.equal(fromUnits(9007199254740993n), '900719925.4740993');
  assert.equal(toUnits('0.0000001'), 1n);
});

test('TRY and USDC use their own precision', () => {
  assert.equal(toUnits('200', 2), 20000n);
  assert.equal(fromUnits(20000n, 2), '200.00');
  assert.equal(toUnits('2'), 20000000n);
});

test('invalid or rounded financial input is rejected', () => {
  for (const value of ['-1', '1e2', 'NaN', ' 2', '2,3', '', '0.00000001', 2]) {
    assert.throws(() => toUnits(value));
  }
  assert.throws(() => toUnits('1.001', 2));
});
