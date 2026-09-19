/** Parse fixed-point strings without rounding or passing through a JS Number. */
export function toUnits(value, decimals = 7) {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Amount must be an unsigned decimal string.');
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) throw new Error(`Amount exceeds ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}

export function fromUnits(value, decimals = 7) {
  if (typeof value !== 'bigint' || value < 0n) throw new Error('Units must be a nonnegative bigint.');
  const scale = 10n ** BigInt(decimals);
  return `${value / scale}.${(value % scale).toString().padStart(decimals, '0')}`;
}
