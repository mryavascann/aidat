import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { AnchorClient, STELLAR_USDC } from "../../../scripts/lib/anchor.mjs";
import { TOKEN } from "../../../scripts/lib/config.mjs";
import { toUnits, fromUnits } from "../../../scripts/lib/amounts.mjs";
import deployment from "../deployment.json";
import { load, save } from "./storage";
import { localSigner, type Signer } from "./wallet";
import { bankFlow, saveBank, type BankFlow } from "../features/banking/model";
export { bankFlow, type BankFlow } from "../features/banking/model";
import {
  addr,
  num,
  u32,
  str,
  bytes,
  call,
  send,
  read,
  trustline,
  walletBalance,
  horizon,
  Operation,
  Address,
  Memo,
  USDC,
} from "./chain";
export { toUnits, fromUnits };
export type Role = "resident" | "admin" | "payee";
export interface Demo {
  secrets: Record<Role, string>;
  salt: number[];
  treasury?: string;
  ready?: boolean;
}
export const getDemo = () => load<Demo | null>("demo", null);
export async function fund(signer: Signer) {
  try {
    await horizon.loadAccount(signer.publicKey());
  } catch (e: any) {
    if (e.response?.status !== 404) throw e;
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(signer.publicKey())}`,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!response.ok) {
      await horizon.loadAccount(signer.publicKey());
    }
  }
  await trustline(signer);
}
export async function createDemo(
  progress: (step: string) => void,
): Promise<Demo> {
  let demo = getDemo();
  if (!demo) {
    demo = {
      secrets: {
        admin: Keypair.random().secret(),
        resident: Keypair.random().secret(),
        payee: Keypair.random().secret(),
      },
      salt: Array.from(crypto.getRandomValues(new Uint8Array(32))),
    };
    save("demo", demo);
  }
  if (demo.ready) return demo;
  for (const role of ["admin", "resident", "payee"] as const) {
    progress(`fund:${role}`);
    await fund(localSigner(demo.secrets[role]));
  }
  const admin = localSigner(demo.secrets.admin);
  const resident = localSigner(demo.secrets.resident);
  progress("create");
  if (!demo.treasury) {
    const result = await send(
      admin,
      Operation.createCustomContract({
        address: new Address(admin.publicKey()),
        wasmHash: Buffer.from(deployment.wasmHash, "hex"),
        salt: Buffer.from(demo.salt),
        constructorArgs: [
          addr(admin.publicKey()),
          addr(TOKEN),
          str("Duly Demo"),
          num("20000"),
          u32(2),
          addr(deployment.vault),
        ],
      }),
      "demo:create",
    );
    demo.treasury = result.value;
    save("demo", demo);
  }
  progress("members");
  await call(
    admin,
    demo.treasury!,
    "add_member",
    [addr(resident.publicKey())],
    "demo:member",
  );
  demo.ready = true;
  save("demo", demo);
  return demo;
}
export async function checkBank(
  signer: Signer,
  flow: BankFlow,
): Promise<BankFlow> {
  if (signer.publicKey() !== flow.account)
    throw new Error("Reconnect the account that opened this bank order.");
  if (flow.complete) return flow;
  const anchor = await new AnchorClient(signer).discover();
  const transaction = await anchor.transaction(flow.order.id);
  const checked = {
    ...flow,
    anchorStatus: transaction.status,
    checkedAt: new Date().toISOString(),
    ...(transaction.status === "completed" ? { settlement: transaction } : {}),
  };
  saveBank(checked);
  return checked;
}
export async function startBank(
  signer: Signer,
  treasury: string,
  kind: "deposit" | "withdraw",
  amount: string,
): Promise<BankFlow> {
  const prior = bankFlow(signer.publicKey(), treasury, kind);
  if (prior && !prior.complete) return prior;
  const units = toUnits(amount, kind === "deposit" ? 2 : 7);
  if (units <= 0n) throw new Error("Invalid amount.");
  if (kind === "deposit") {
    if (!(await read(treasury, "members")).includes(signer.publicKey()))
      throw new Error("Join this community before contributing.");
  } else if (toUnits(await walletBalance(signer.publicKey())) < units)
    throw new Error("Insufficient wallet balance.");
  await trustline(signer);
  const anchor = await new AnchorClient(signer).discover();
  const order = await anchor.start(
    kind,
    fromUnits(units, kind === "deposit" ? 2 : 7),
  );
  const flow = {
    kind,
    account: signer.publicKey(),
    treasury,
    amount,
    order,
    createdAt: new Date().toISOString(),
  };
  saveBank(flow);
  return flow;
}
export async function finishBank(
  signer: Signer,
  flow: BankFlow,
  progress: (step: string) => void,
  onUpdate: (flow: BankFlow) => void = () => {},
): Promise<BankFlow> {
  if (signer.publicKey() !== flow.account)
    throw new Error("Reconnect the account that opened this bank order.");
  if (flow.complete) return flow;
  const persist = () => {
    saveBank(flow);
    onUpdate({ ...flow });
  };
  const onTransaction = (transaction: any) => {
    flow.anchorStatus = transaction.status;
    flow.checkedAt = new Date().toISOString();
    persist();
  };
  const anchor = await new AnchorClient(signer).discover();
  progress("bank");
  if (flow.kind === "deposit") {
    if (!flow.settlement) {
      const current = await anchor.transaction(flow.order.id);
      onTransaction(current);
      if (current.status === "pending_user_transfer_start") {
        if (Date.parse(flow.order.quote.expires_at) <= Date.now())
          throw new Error(
            "This quote has expired. Check the saved bank order before any new transfer.",
          );
        flow.submittedAt ??= new Date().toISOString();
        persist();
        await anchor.simulateDeposit(
          flow.order.id,
          flow.order.quote.sell_amount,
        );
      }
      flow.settlement = await anchor.wait(flow.order.id, {
        ensureTrustline: () => trustline(signer),
        onTransaction,
      });
      persist();
    }
    if (
      flow.settlement.amount_out_asset &&
      flow.settlement.amount_out_asset !== STELLAR_USDC
    )
      throw new Error("Unexpected settlement asset.");
    if (!flow.settlement.stellar_transaction_id)
      throw new Error("No Stellar settlement receipt.");
    if (flow.settlement.claimable_balance_id) {
      await send(
        signer,
        Operation.claimClaimableBalance({
          balanceId: flow.settlement.claimable_balance_id,
        }),
        `claim:${flow.order.id}`,
        { classic: true },
      );
    }
    progress("vault");
    // Transfer only this bank deposit, never sweep other wallet funds.
    const result = await call(
      signer,
      flow.treasury,
      "contribute",
      [addr(flow.account), num(toUnits(flow.settlement.amount_out))],
      `contribution:${flow.order.id}`,
    );
    flow.receipt = result.hash;
  } else {
    const order = flow.order;
    if (
      order.memo_type !== "id" ||
      !/^\d+$/.test(String(order.memo)) ||
      !StrKey.isValidEd25519PublicKey(order.account_id)
    )
      throw new Error("Invalid anchor destination or memo.");
    const intent = `withdraw:${order.id}`;
    const signed = load(`tx:${signer.publicKey()}:${intent}`, null);
    const current = await anchor.transaction(order.id);
    onTransaction(current);
    // An order already processing at the bank must never trigger a fresh send.
    // Only the exact saved Stellar envelope may be reconciled in that case.
    if (!signed && current.status !== "pending_user_transfer_start")
      throw new Error(
        "The bank order is already processing or needs attention. Keep this reference for reconciliation; no new transfer was signed.",
      );
    if (!signed && Date.parse(order.quote.expires_at) <= Date.now()) {
      throw new Error(
        "This quote expired before signing. Keep the order reference and reconcile its status before starting another withdrawal.",
      );
    }
    progress("payment");
    flow.submittedAt ??= new Date().toISOString();
    persist();
    const result = await send(
      signer,
      Operation.payment({
        destination: order.account_id,
        asset: USDC,
        amount: fromUnits(toUnits(order.quote.sell_amount)),
      }),
      intent,
      { classic: true, memo: Memo.id(String(order.memo)) },
    );
    flow.receipt = result.hash;
    persist();
    progress("bank");
    flow.settlement = await anchor.wait(order.id, { onTransaction });
    if (!flow.settlement.external_transaction_id)
      throw new Error("No bank sandbox receipt.");
  }
  flow.complete = true;
  persist();
  return flow;
}
export async function createInvite(
  signer: Signer,
  treasury: string,
): Promise<string> {
  const key = `invite:${treasury}`;
  let draft = load<{ code: string; done?: boolean } | null>(key, null);
  if (!draft || draft.done) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    draft = {
      code: btoa(String.fromCharCode(...raw))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", ""),
    };
    save(key, draft);
  }
  const raw = new TextEncoder().encode(draft.code);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  await call(
    signer,
    treasury,
    "create_invite",
    [bytes(hash), u32(1), u32(17280)],
    `invite:${draft.code}`,
  );
  draft.done = true;
  save(key, draft);
  const url = new URL(location.origin);
  url.searchParams.set("treasury", treasury);
  url.searchParams.set("invite", draft.code);
  return url.href;
}
export async function join(signer: Signer, treasury: string, code: string) {
  if (!/^[A-Za-z0-9_-]{22,128}$/.test(code))
    throw new Error("Invalid invitation.");
  await call(
    signer,
    treasury,
    "join",
    [addr(signer.publicKey()), bytes(new TextEncoder().encode(code))],
    `join:${treasury}:${code}`,
  );
}
