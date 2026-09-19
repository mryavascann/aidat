export type DuesPayment = {
  hash: string;
  seat: number;
  amountTry: string;
  amountUsdc: string;
  paidAt: number;
  method: "TRY" | "USDC";
};
export type DuesLedger = { address: string; payments: DuesPayment[] };
type Config = {
  start_time: bigint;
  start_ledger: number;
  period_seconds: bigint;
  period_ledgers: number;
  dues_try: bigint;
};
type Apartment = { id: number; owner: string; paid: bigint };

// A fresh quote is safe only before any signed intent has been persisted.
// Leave enough time for the normal 180-second transaction validity window.
export function canRefreshDuesQuote(
  expiresAt: string | undefined,
  hasSignedIntent: boolean,
  now = Date.now(),
) {
  const expiry = Date.parse(expiresAt ?? "");
  return (
    !hasSignedIntent && (!Number.isFinite(expiry) || expiry <= now + 180000)
  );
}

// The setup-relative billing cycle follows the accepted 30-day budget cycle.
// Both clocks must cross the boundary; the demo uses its own 10-minute cycle.
export function duesPeriod(config: Config, now: number, ledger: number) {
  return Math.min(
    Math.max(
      0,
      Math.floor(
        (now - Number(config.start_time)) / Number(config.period_seconds),
      ),
    ),
    Math.max(
      0,
      Math.floor((ledger - config.start_ledger) / config.period_ledgers),
    ),
  );
}
export function duesPeriodRange(config: Config, period: number) {
  const start =
    Number(config.start_time) + period * Number(config.period_seconds);
  return { start, end: start + Number(config.period_seconds) };
}
export function duesReport(
  config: Config,
  seats: Apartment[],
  payments: DuesPayment[],
  currentPeriod: number,
  selectedPeriod: number,
) {
  const period = Math.min(Math.max(0, selectedPeriod), currentPeriod);
  return seats.map((seat) => {
    const entries = payments.filter((p) => p.seat === seat.id);
    const credited = entries.reduce((sum, p) => sum + BigInt(p.amountTry), 0n);
    const indexedUsdc = entries.reduce(
      (sum, p) => sum + BigInt(p.amountUsdc),
      0n,
    );
    const before = BigInt(period) * config.dues_try;
    const available = credited > before ? credited - before : 0n;
    const paid = available > config.dues_try ? config.dues_try : available;
    const accrued = BigInt(currentPeriod + 1) * config.dues_try;
    const unmatched = seat.paid !== indexedUsdc;
    return {
      ...seat,
      credited,
      due: config.dues_try,
      paid,
      remaining: config.dues_try - paid,
      arrears: accrued > credited ? accrued - credited : 0n,
      advance: credited > accrued ? credited - accrued : 0n,
      unmatched,
      status: unmatched
        ? "review"
        : paid === config.dues_try
          ? "paid"
          : paid > 0n
            ? "partial"
            : "unpaid",
      lastPayment: entries.length
        ? Math.max(...entries.map((p) => p.paidAt))
        : null,
    };
  });
}

export async function duesRequest(request: unknown) {
  const response = await fetch("/api/dues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json();
  if (!response.ok || result.error)
    throw new Error(result.error ?? "Dues records unavailable.");
  return result;
}
export function loadDues(treasury: string): Promise<DuesLedger> {
  return duesRequest({ action: "ledger", treasury });
}
