import {
  Address,
  Asset,
  Contract,
  Keypair,
  StrKey,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@duly/stellar-sdk";
import deployment from "../building-deployment.json";
import {
  addr,
  bytes,
  call,
  delay,
  hex,
  horizon,
  Operation,
  send,
  USDC,
  num,
  read,
  server,
  str,
  trustline,
  u32,
} from "./chain";
import { load, save } from "./storage";
import { canRefreshDuesQuote, duesRequest } from "./dues";
import { localSigner, type Signer } from "./wallet";
import {
  demoFundingAmount,
  demoFundingPlan,
  type DemoFundingPlan,
} from "./demo-funding";
import {
  bankRecord,
  hasContributionIntent,
  saveBank,
  type BankRecord,
} from "./bank-records";
export { bankRecords, type BankRecord } from "./bank-records";
export { deployment, addr, bytes, num, str, u32, delay };
export { toUnits, fromUnits } from "../../../scripts/lib/amounts.mjs";
import { fromUnits, toUnits } from "../../../scripts/lib/amounts.mjs";
export type Identity = {
  kind: "passkey" | "wallet" | "demo";
  address: string;
  signer?: Signer;
};
export type Seat = {
  id: number;
  owner: string;
  delegate: string | null;
  version: number;
  paid: bigint;
};
export type Vote = { seat: number; version: number; support: boolean };
export type Expense = {
  id: number;
  description: string;
  recipient: Uint8Array;
  amount_try: bigint;
  max_usdc: bigint;
  status: string;
  routine: boolean;
  recipient_exception: boolean;
  budget_exception: boolean;
  vetoed: boolean;
  ready_ledger: number;
  ready_time: bigint;
  votes: Vote[];
  tally: [number, number];
  quote: any;
  bank_receipt: Uint8Array | null;
};
export type Motion = {
  id: number;
  kind: [string, any];
  status: string;
  votes: Vote[];
  tally: [number, number];
  ready_ledger: number;
  ready_time: bigint;
};
export type BuildingData = {
  config: {
    name: string;
    manager: string;
    seat_count: number;
    dues_try: bigint;
    demo: boolean;
    bank: string;
    token: string;
    vault: string;
    budget: { limit_try: bigint; limit_usdc: bigint };
    start_time: bigint;
    start_ledger: number;
    period_seconds: bigint;
    period_ledgers: number;
    objection_seconds: bigint;
    recovery_seconds: bigint;
  };
  seats: Seat[];
  expenses: Expense[];
  motions: Motion[];
  recipients: { id: Uint8Array; label: string; enabled: boolean }[];
  total: bigint;
  spent: { period: bigint; amount_try: bigint; amount_usdc: bigint };
  ledger: number;
};
export const enumValue = (name: string, value?: xdr.ScVal) =>
  xdr.ScVal.scvVec([
    nativeToScVal(name, { type: "symbol" }),
    ...(value ? [value] : []),
  ]);
export const struct = (value: Record<string, xdr.ScVal>) =>
  xdr.ScVal.scvMap(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([k, v]) =>
          new xdr.ScMapEntry({
            key: nativeToScVal(k, { type: "symbol" }),
            val: v,
          }),
      ),
  );
export const bool = (value: boolean) => nativeToScVal(value);
export const optionalAddress = (value: string) =>
  value ? addr(value) : xdr.ScVal.scvVoid();
export const hashBytes = (value: string) =>
  bytes(Uint8Array.from(value.match(/../g) ?? [], (b) => parseInt(b, 16)));
const state = (value: any) => (Array.isArray(value) ? value[0] : value);

const verified = new Set<string>();
export async function verifyBuilding(id: string) {
  if (verified.has(id)) return;
  if (!StrKey.isValidContract(id)) throw new Error("Invalid building address.");
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
  const response = await server.getLedgerEntries(key);
  const value = response.entries[0]?.val;
  if (
    !value ||
    value.type !== "contractData" ||
    value.contractData.val.type !== "scvContractInstance"
  )
    throw new Error("Building is unavailable.");
  const executable = value.contractData.val.instance.executable;
  if (
    executable.type !== "contractExecutableWasm" ||
    ![
      deployment.wasmHash,
      deployment.demoWasmHash,
      ...deployment.priorWasmHashes,
    ].includes(hex(executable.wasmHash.value))
  )
    throw new Error("This is not a verified Duly V3 building.");
  const cfg = await read(id, "config");
  if (
    cfg.bank !== deployment.bank ||
    cfg.token !== deployment.token ||
    cfg.vault !== deployment.vault
  )
    throw new Error("Unexpected building bank or reserve.");
  verified.add(id);
}
export async function buildingSnapshot(id: string): Promise<BuildingData> {
  await verifyBuilding(id);
  const [config, seats, total, spent, ec, mc, recipients, ledger] =
    await Promise.all([
      read(id, "config"),
      read(id, "seats"),
      read(id, "balance"),
      read(id, "period_spent"),
      read(id, "expense_count"),
      read(id, "motion_count"),
      read(id, "recipients"),
      server.getLatestLedger(),
    ]);
  const [expenses, motions, paid] = await Promise.all([
    Promise.all(
      Array.from({ length: Math.min(50, ec) }, (_, i) => ec - i).map(
        async (n) => {
          const [e, tally] = await Promise.all([
            read(id, "expense", [u32(n)]),
            read(id, "expense_tally", [u32(n)]),
          ]);
          return { ...e, status: state(e.status), tally };
        },
      ),
    ),
    Promise.all(
      Array.from({ length: Math.min(50, mc) }, (_, i) => mc - i).map(
        async (n) => {
          const [m, tally] = await Promise.all([
            read(id, "motion", [u32(n)]),
            read(id, "motion_tally", [u32(n)]),
          ]);
          return { ...m, status: state(m.status), tally };
        },
      ),
    ),
    Promise.all(seats.map((s: Seat) => read(id, "contribution", [u32(s.id)]))),
  ]);
  return {
    config,
    seats: seats.map((s: Seat, i: number) => ({ ...s, paid: paid[i] })),
    total,
    spent,
    expenses,
    motions,
    recipients,
    ledger: ledger.sequence,
  };
}
export async function invoke(
  identity: Identity,
  target: string,
  method: string,
  args: xdr.ScVal[],
  intent: string,
) {
  if (identity.kind !== "passkey")
    return call(identity.signer!, target, method, args, `v3:${intent}`);
  const { invokeAccount } = await import("@duly/accounts");
  const result = await invokeAccount(
    target,
    method,
    args.map((v) => v.toXdr("base64")),
    `${identity.address}:${intent}`,
  );
  const confirmed = await server.getTransaction(result.hash!);
  if (confirmed.status !== "SUCCESS")
    throw new Error("Confirmation pending; resume this same action.");
  let value = confirmed.returnValue
    ? scValToNative(confirmed.returnValue)
    : undefined;
  // OpenZeppelin account.execute returns void. Read the inner operation's
  // result only from this successful transaction's event emitted by the
  // expected Duly contract, never from a later shared counter.
  const eventName =
    method === "create"
      ? "building_created"
      : method === "propose_expense"
        ? "expense_created"
        : ["propose_motion", "propose_recovery"].includes(method)
          ? "motion_created"
          : null;
  if (eventName) {
    const matches = (confirmed.events?.contractEventsXdr ?? [])
      .flat()
      .filter(
        (event) =>
          event.contractId &&
          StrKey.encodeContract(event.contractId.value) === target &&
          event.body.type === "v0" &&
          scValToNative(event.body.v0.topics[0]) === eventName,
      );
    if (matches.length !== 1)
      throw new Error("Confirmed transaction has no unique Duly result event.");
    value = scValToNative(matches[0].body.v0.topics[1]);
  }
  return {
    hash: result.hash!,
    value,
    ledger: confirmed.ledger,
  };
}
export function intentFor(form: string, details: unknown) {
  const key = `v3:intent:${form}`,
    serialized = JSON.stringify(details);
  let intent = load<{ details: string; id: string } | null>(key, null);
  if (intent && intent.details !== serialized)
    throw new Error("Resume the saved action before changing its fields.");
  if (!intent) {
    intent = { details: serialized, id: crypto.randomUUID() };
    save(key, intent);
  }
  return intent.id;
}
export function completeIntent(form: string) {
  localStorage.removeItem(`duly:v3:intent:${form}`);
}
export function createBuilding(
  identity: Identity,
  name: string,
  owners: string[],
  dues: bigint,
  demo = false,
) {
  if (
    owners.length < 2 ||
    owners.length > 128 ||
    owners.some(
      (a) => !StrKey.isValidEd25519PublicKey(a) && !StrKey.isValidContract(a),
    )
  )
    throw new Error("Enter 2–128 valid owner addresses, one per apartment.");
  const form = `building:${identity.address}`;
  const intent = intentFor(form, [name, owners, dues.toString(), demo]);
  let salt = load<string | null>(`v3:salt:${intent}`, null);
  if (!salt) {
    salt = hex(crypto.getRandomValues(new Uint8Array(32)));
    save(`v3:salt:${intent}`, salt);
  }
  return invoke(
    identity,
    deployment.factory,
    "create",
    [
      addr(identity.address),
      xdr.ScVal.scvVec(owners.map(addr)),
      str(name),
      num(dues),
      hashBytes(salt),
      bool(demo),
    ],
    intent,
  ).then((r) => {
    if (typeof r.value !== "string" || !StrKey.isValidContract(r.value))
      throw new Error("Building creation must be reconciled from its receipt.");
    completeIntent(form);
    return r;
  });
}
export type Demo = { secrets: string[]; treasury?: string; ready?: boolean };
export const getBuildingDemo = () => load<Demo | null>("v3:demo", null);
export async function startBuildingDemo(progress: (value: string) => void) {
  let demo = getBuildingDemo();
  if (!demo) {
    demo = {
      secrets: Array.from({ length: 3 }, () => Keypair.random().secret()),
    };
    save("v3:demo", demo);
  }
  for (let i = 0; i < 3; i++) {
    const signer = localSigner(demo.secrets[i]);
    progress(`demo-fund:${i + 1}`);
    try {
      await horizon.loadAccount(signer.publicKey());
    } catch (e: any) {
      if (e.response?.status !== 404) throw e;
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${signer.publicKey()}`,
      );
      if (!response.ok)
        throw new Error(
          "Testnet funding is temporarily unavailable. Resume the same demo.",
        );
    }
    await trustline(signer);
  }
  if (!demo.treasury) {
    progress("demo-building");
    const signer = localSigner(demo.secrets[0]);
    const receipt = await createBuilding(
      { kind: "demo", address: signer.publicKey(), signer },
      "Duly Demo",
      demo.secrets.map((s) => localSigner(s).publicKey()),
      20_000n,
      true,
    );
    demo.treasury = receipt.value;
    save("v3:demo", demo);
  }
  await fundDemoWallets(demo, progress);
  demo.ready = true;
  save("v3:demo", demo);
  return demo;
}
export function demoIdentity(demo: Demo, index = 0): Identity {
  const signer = localSigner(demo.secrets[index]);
  return { kind: "demo", address: signer.publicKey(), signer };
}
export async function simulateVotes(
  demo: Demo,
  id: number,
  motion = true,
  support = true,
) {
  for (let index = 1; index < 3; index++) {
    const identity = demoIdentity(demo, index);
    const current = await read(demo.treasury!, motion ? "motion" : "expense", [
      u32(id),
    ]);
    if (state(current.status) !== "Pending") return;
    if (
      motion &&
      current.kind[0] === "Recovery" &&
      current.kind[1].seat === index + 1
    )
      continue;
    await invoke(
      identity,
      demo.treasury!,
      motion ? "vote_motion" : "vote_expense",
      [u32(index + 1), addr(identity.address), u32(id), bool(support)],
      `demo-vote:${motion}:${id}:${index}:${support}`,
    );
  }
}

export async function bankRequest(body: unknown) {
  const response = await fetch("/api/bank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json();
  if (!response.ok || result.error)
    throw new Error(result.error ?? "Bank service is unavailable.");
  return result;
}
export async function startDeposit(
  treasury: string,
  identity: Identity,
  seat: number,
  amount: string,
) {
  if (identity.kind !== "passkey") await trustline(identity.signer!);
  const response = await bankRequest({
    action: "deposit",
    treasury,
    account: identity.address,
    seat,
    amount,
  });
  return saveBank({
    ...response,
    kind: "deposit",
    key: response.anchorId,
    treasury,
    account: identity.address,
    seat,
  });
}
export async function resumeBank(record: BankRecord, action = "resume") {
  record = bankRecord(record.key) ?? record;
  if (record.stoppedAt || record.phase === "cancelled") return record;
  const response = await bankRequest(
    record.queued
      ? { action: "tick", treasury: record.treasury, id: record.id }
      : { saved: record.saved, action },
  );
  return saveBank({ ...record, ...response });
}
export async function checkDepositStatus(record: BankRecord) {
  if (record.kind !== "deposit") throw new Error("permissionDenied");
  const response = await bankRequest({ action: "status", saved: record.saved });
  return saveBank({ ...(bankRecord(record.key) ?? record), ...response });
}
export async function registerPayment(
  treasury: string,
  id: number,
  iban: string,
) {
  const result = await bankRequest({ action: "register", treasury, id, iban });
  return saveBank(result);
}
export async function finishDeposit(
  record: BankRecord,
  identity: Identity,
  progress: (s: string) => void,
) {
  let next = bankRecord(record.key) ?? record;
  if (next.stoppedAt || next.phase === "complete") return next;
  if (next.account !== identity.address)
    throw new Error("Reconnect the account that started this payment.");
  if (next.phase === "recording-dues") return finishDuesRecord(next, progress);
  for (
    let i = 0;
    i < 4 && !["contribute", "contributing"].includes(next.phase);
    i++
  ) {
    progress(next.phase);
    next = await resumeBank(next);
    // The bank owns this wait. Return control instead of locking the form in
    // a long polling loop. A stop during the request preserves its response.
    if (next.stoppedAt || next.phase === "processing") return next;
  }
  next = bankRecord(next.key) ?? next;
  if (next.stoppedAt || !["contribute", "contributing"].includes(next.phase))
    return next;
  next = saveBank({ ...next, phase: "contributing" });
  progress("contribute");
  try {
    const receipt = await invoke(
      identity,
      next.treasury,
      "contribute",
      [addr(identity.address), u32(next.seat!), num(toUnits(next.amountUsdc!))],
      `deposit:${next.key}`,
    );
    next = saveBank({
      ...next,
      phase: "recording-dues",
      receipt: receipt.hash,
    });
  } catch (error) {
    if (!hasContributionIntent(next))
      saveBank({ ...next, phase: "contribute" });
    throw error;
  }
  return finishDuesRecord(next, progress);
}
async function finishDuesRecord(
  record: BankRecord,
  progress: (s: string) => void,
) {
  progress("recording-dues");
  await duesRequest({
    action: "record",
    treasury: record.treasury,
    saved: record.saved,
    receipt: record.receipt,
  });
  return saveBank({ ...record, phase: "complete" });
}
export async function startDirectDues(
  treasury: string,
  identity: Identity,
  seat: number,
  amount: string,
) {
  const quote = await duesRequest({
    action: "quote",
    treasury,
    account: identity.address,
    seat,
    amount,
  });
  return saveBank({
    ...quote,
    key: crypto.randomUUID(),
    treasury,
    account: identity.address,
    seat,
    kind: "usdc",
    phase: "quoted",
  });
}
export async function finishDirectDues(
  record: BankRecord,
  identity: Identity,
  progress: (s: string) => void,
) {
  if (record.phase === "complete") return record;
  if (record.account !== identity.address)
    throw new Error("Reconnect the account that started this contribution.");
  if (record.phase === "recording-dues")
    return finishDuesRecord(record, progress);
  const intent = `usdc:${record.key}`;
  const signedIntent = load(
    identity.kind === "passkey"
      ? `v3:passkey:${identity.address}:${intent}`
      : `tx:${identity.address}:v3:${intent}`,
    null,
  );
  if (canRefreshDuesQuote(record.expiresAt, !!signedIntent)) {
    // Nothing signed: refreshing cannot orphan an already submitted payment.
    // Keep the same intent so uncertain signed payments are always reconciled.
    const quote = await duesRequest({
      action: "quote",
      treasury: record.treasury,
      account: record.account,
      seat: record.seat,
      amount: record.amountUsdc,
    });
    record = saveBank({ ...record, ...quote });
  }
  progress("contribute");
  const receipt = await invoke(
    identity,
    record.treasury,
    "contribute",
    [
      addr(identity.address),
      u32(record.seat!),
      num(toUnits(record.amountUsdc!)),
    ],
    intent,
  );
  const next = saveBank({
    ...record,
    phase: "recording-dues",
    receipt: receipt.hash,
  });
  return finishDuesRecord(next, progress);
}
export async function fundDemoUsdc(
  treasury: string,
  account: string,
  progress: (s: string) => void,
) {
  const demo = getBuildingDemo();
  if (
    !demo?.ready ||
    demo.treasury !== treasury ||
    demoIdentity(demo).address !== account
  )
    throw new Error("permissionDenied");
  await verifyBuilding(treasury);
  return fundDemoWallets(demo, progress);
}

async function fundDemoWallets(demo: Demo, progress: (s: string) => void) {
  if (demo.secrets.length !== 3) throw new Error("permissionDenied");
  for (let index = 0; index < 3; index++) {
    progress(`demo-usdc:${index + 1}`);
    const signer = localSigner(demo.secrets[index]);
    const address = signer.publicKey();
    const planKey = `v3:demo-usdc-plan:${address}`;
    let plan = load<DemoFundingPlan | null>(planKey, null);
    if (!plan) {
      const amount = demoFundingAmount(await accountBalance(address));
      if (!amount) continue;
      const paths = await horizon
        .strictReceivePaths([Asset.native()], USDC, fromUnits(amount))
        .call();
      plan = demoFundingPlan(amount, paths.records, USDC.getIssuer()!);
      save(planKey, plan);
    }
    // A fixed per-wallet intent preserves the exact signed envelope on retry.
    // This only uses disposable demo XLM and never records a dues contribution.
    await send(
      signer,
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: plan.sendMax,
        destination: address,
        destAsset: USDC,
        destAmount: plan.amount,
        path: [],
      }),
      "v3:demo-usdc",
      { classic: true },
    );
  }
  return { phase: "complete" };
}
export async function payExpense(
  treasury: string,
  id: number,
  iban: string,
  progress: (s: string) => void,
) {
  const key = `expense:${treasury}:${id}`;
  let record = load<BankRecord[]>("v3:bank", []).find((r) => r.key === key);
  if (!record) {
    progress("quote");
    const result = await bankRequest({
      action: "register",
      treasury,
      id,
      iban,
    });
    record = saveBank({ ...result, kind: "withdraw", treasury, id, key });
  }
  for (let i = 0; i < 40 && record.phase !== "complete"; i++) {
    progress(record.phase);
    const action = ["quoted", "attesting"].includes(record.phase)
      ? "attest"
      : record.phase === "attested"
        ? "execute"
        : "resume";
    record = await resumeBank(record, action);
    if (
      ["awaiting-funds", "needs-review", "processing", "cancelled"].includes(
        record.phase,
      )
    )
      return record;
    if (record.phase !== "complete") await delay(1500);
  }
  return record;
}
export async function accountBalance(address: string) {
  return read(deployment.token, "balance", [addr(address)]) as Promise<bigint>;
}
