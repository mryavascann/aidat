import { toUnits, fromUnits } from "../../../scripts/lib/amounts.mjs";

export const RATE_MAX_AGE_MS = 60_000;
export const DEMO_MANAGER_IBAN = "TR330006100519786457841326";
export const managerIbanKey = (building: string, manager: string) =>
  `v3:manager-iban:${building}:${manager}`;

export function availableExpenseFunds(
  total: bigint,
  expenses: { status: string; max_usdc: bigint }[],
): bigint {
  const reserved = expenses.reduce(
    (sum, expense) =>
      sum + (expense.status === "Pending" ? expense.max_usdc : 0n),
    0n,
  );
  return total > reserved ? total - reserved : 0n;
}

/** 10% headroom, rounded upward to a USDC cent using integer arithmetic. */
export function expenseCeiling(amountTry: string, sellRate: number): string {
  const amount = toUnits(amountTry, 2);
  if (amount <= 0n || !Number.isFinite(sellRate) || sellRate <= 0)
    throw new Error("A positive amount and a current sell rate are required.");
  const rate = toUnits(sellRate.toFixed(7));
  if (rate <= 0n) throw new Error("Invalid sell rate.");
  const numerator = amount * 11n * 10_000_000n;
  const denominator = rate * 10n;
  const cents = (numerator + denominator - 1n) / denominator;
  return fromUnits(cents, 2);
}

export function isFreshRate(receivedAt: number, now: number): boolean {
  return (
    receivedAt > 0 && now >= receivedAt && now - receivedAt < RATE_MAX_AGE_MS
  );
}

export function displayName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40)
    throw new Error("Invalid display name.");
  return name;
}
