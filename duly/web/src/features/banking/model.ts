import { load, save } from "../../lib/storage.ts";

export type BankKind = "deposit" | "withdraw";
export interface BankFlow {
  kind: BankKind;
  account: string;
  treasury: string;
  amount: string;
  order: any;
  settlement?: any;
  receipt?: string;
  complete?: boolean;
  createdAt: string;
  submittedAt?: string;
  checkedAt?: string;
  anchorStatus?: string;
}
export type BankPhase =
  "ready" | "processing" | "contribute" | "complete" | "expired" | "attention";

const terminal = new Set([
  "error",
  "expired",
  "refunded",
  "no_market",
  "too_small",
  "too_large",
]);
const waiting = new Set([
  "pending_user_transfer_start",
  "pending_user_transfer_complete",
  "pending_external",
  "pending_anchor",
  "pending_stellar",
  "pending_trust",
]);

// Quote expiry alone says nothing about money already sent. Confirmed settlement
// and saved payment attempts take precedence; unknown statuses need reconciliation.
export function bankPhase(flow: BankFlow, now = Date.now()): BankPhase {
  if (flow.complete) return "complete";
  const status = flow.anchorStatus ?? flow.settlement?.status;
  if (status && terminal.has(status))
    return status === "expired" ? "expired" : "attention";
  if (status && status !== "completed" && !waiting.has(status))
    return "attention";
  if (flow.kind === "deposit" && flow.settlement?.status === "completed")
    return "contribute";
  if (
    flow.receipt ||
    flow.submittedAt ||
    status === "completed" ||
    (status && status !== "pending_user_transfer_start")
  )
    return "processing";
  const expiry = Date.parse(flow.order.quote.expires_at);
  if (!Number.isFinite(expiry)) return "attention";
  return expiry <= now ? "expired" : "ready";
}

export function bankStep(flow: BankFlow): number {
  if (flow.complete) return 3;
  if (flow.kind === "deposit")
    return flow.settlement?.status === "completed" ? 2 : 1;
  return flow.receipt ? 2 : 1;
}

const bankKey = (account: string, treasury: string, kind: BankKind) =>
  `bank:${treasury}:${account}:${kind}`;
const historyKey = (account: string, treasury: string) =>
  `bank-history:${treasury}:${account}`;

// Keep old single-order keys readable so existing testnet payments survive the
// redesign. The history record wins when an older mirror exists for the same ID.
export function bankHistory(account: string, treasury: string): BankFlow[] {
  if (!account) return [];
  const legacy = (["deposit", "withdraw"] as const).map((kind) =>
    load<BankFlow | null>(bankKey(account, treasury, kind), null),
  );
  const history = load<BankFlow[]>(historyKey(account, treasury), []);
  const unique = new Map<string, BankFlow>();
  for (const flow of [...legacy, ...history]) {
    if (
      flow?.order?.id &&
      flow.account === account &&
      flow.treasury === treasury
    )
      unique.set(flow.order.id, flow);
  }
  return [...unique.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function bankFlow(
  account: string,
  treasury: string,
  kind: BankKind,
): BankFlow | null {
  const history = bankHistory(account, treasury).filter(
    (flow) => flow.kind === kind,
  );
  return history.find((flow) => !flow.complete) ?? history[0] ?? null;
}

export function saveBank(flow: BankFlow) {
  const history = bankHistory(flow.account, flow.treasury).filter(
    (prior) => prior.order.id !== flow.order.id,
  );
  save(historyKey(flow.account, flow.treasury), [flow, ...history]);
  save(bankKey(flow.account, flow.treasury, flow.kind), flow);
}
