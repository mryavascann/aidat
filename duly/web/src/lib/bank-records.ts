import { load, save } from "./storage.ts";

export type BankRecord = {
  reason?: string | null;
  availableUsdc?: string | null;
  requiredUsdc?: string | null;
  queued?: boolean;
  saved: string;
  phase: string;
  kind: "deposit" | "withdraw" | "usdc";
  key: string;
  treasury: string;
  account?: string;
  seat?: number;
  id?: number;
  amountTry?: string;
  amountUsdc?: string;
  anchorId?: string;
  receipt?: string;
  settlementHash?: string;
  bankStatus?: string;
  statusCheckedAt?: string;
  bankReference?: string;
  iban?: string;
  reference?: string;
  expiresAt?: string;
  stoppedAt?: string;
  cancellationReceipt?: string;
};

export const bankRecord = (key: string) =>
  load<BankRecord[]>("v3:bank", []).find((record) => record.key === key);

export function bankRecords(treasury: string, account: string): BankRecord[] {
  return load<BankRecord[]>("v3:bank", []).filter(
    (r) =>
      r.treasury === treasury &&
      (r.kind === "withdraw" || r.account === account),
  );
}

export function saveBank(record: BankRecord, resume = false) {
  const rows = load<BankRecord[]>("v3:bank", []);
  const prior = rows.find((r) => r.key === record.key);
  // A late bank response may update its receipt, but must never undo a user's
  // stop request. Only an explicit resume under the payment lock clears it.
  const next = {
    ...record,
    ...(prior?.kind === "withdraw" && prior.phase === "cancelled"
      ? {
          phase: "cancelled",
          cancellationReceipt:
            prior.cancellationReceipt ?? record.cancellationReceipt,
        }
      : {}),
    stoppedAt: resume ? undefined : (prior?.stoppedAt ?? record.stoppedAt),
  };
  save("v3:bank", [next, ...rows.filter((r) => r.key !== record.key)]);
  return next;
}

export function blocksNewContribution(record: BankRecord) {
  return (
    ["deposit", "usdc"].includes(record.kind) &&
    !["complete", "cancelled"].includes(record.phase) &&
    !record.stoppedAt
  );
}

export function hasContributionIntent(record: BankRecord) {
  if (!record.account) return false;
  return !!(
    load(`v3:passkey:${record.account}:deposit:${record.key}`, null) ||
    load(`tx:${record.account}:v3:deposit:${record.key}`, null)
  );
}

export function canStopDeposit(record: BankRecord) {
  return (
    record.kind === "deposit" &&
    !record.stoppedAt &&
    ["quoted", "processing", "transfer-ready", "contribute"].includes(
      record.phase,
    ) &&
    !hasContributionIntent(record)
  );
}

// This cancels Duly's unsigned contribution workflow, not the bank transfer.
// Keep the sealed route, current phase and all receipts for reconciliation.
export function stopDeposit(record: BankRecord, account: string) {
  const current = bankRecord(record.key);
  if (!current || current.account !== account)
    throw new Error("permissionDenied");
  if (current.stoppedAt) return current;
  if (!canStopDeposit(current)) throw new Error("duesAlreadySubmitted");
  return saveBank({ ...current, stoppedAt: new Date().toISOString() });
}

export function reactivateDeposit(record: BankRecord, account: string) {
  const current = bankRecord(record.key);
  if (!current || current.kind !== "deposit" || current.account !== account)
    throw new Error("permissionDenied");
  if (
    bankRecords(current.treasury, account).some(
      (r) => r.key !== current.key && blocksNewContribution(r),
    )
  )
    throw new Error("otherDuesPending");
  return saveBank(current, true);
}
