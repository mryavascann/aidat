import { fromUnits, toUnits } from "../../../scripts/lib/amounts.mjs";

export const DEMO_USDC_TARGET = 20n * 10_000_000n;
const MAX_TEST_XLM = 100n * 10_000_000n;

export type DemoFundingPlan = { amount: string; sendMax: string };
type FundingPath = {
  source_asset_type: string;
  source_amount: string;
  destination_amount: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  path: unknown[];
};

export function demoFundingAmount(balance: bigint) {
  return balance < DEMO_USDC_TARGET ? DEMO_USDC_TARGET - balance : 0n;
}

/** Only the direct XLM → configured USDC market, with a fixed test-XLM cap. */
export function demoFundingPlan(
  amount: bigint,
  paths: FundingPath[],
  issuer: string,
): DemoFundingPlan {
  if (amount <= 0n || amount > DEMO_USDC_TARGET)
    throw new Error("demoFundingUnavailable");
  const offers = paths.filter(
    (p) =>
      p.source_asset_type === "native" &&
      p.destination_asset_code === "USDC" &&
      p.destination_asset_issuer === issuer &&
      toUnits(p.destination_amount) === amount &&
      p.path.length === 0 &&
      toUnits(p.source_amount) > 0n &&
      toUnits(p.source_amount) <= MAX_TEST_XLM,
  );
  if (!offers.length) throw new Error("demoFundingUnavailable");
  const source = offers.reduce(
    (best, p) =>
      toUnits(p.source_amount) < best ? toUnits(p.source_amount) : best,
    MAX_TEST_XLM,
  );
  const buffered = (source * 105n + 99n) / 100n;
  return {
    amount: fromUnits(amount),
    sendMax: fromUnits(buffered > MAX_TEST_XLM ? MAX_TEST_XLM : buffered),
  };
}
