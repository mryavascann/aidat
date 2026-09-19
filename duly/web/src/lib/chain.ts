import {
  Account,
  Asset,
  Address,
  Contract,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@duly/stellar-sdk";
import {
  NETWORK,
  RPC_URL,
  HORIZON_URL,
  ANCHOR,
  USDC_ISSUER,
} from "../../../scripts/lib/config.mjs";
const USDC = new Asset("USDC", USDC_ISSUER);
import { load, save } from "./storage";
import type { Signer } from "./wallet";
import deployment from "../deployment.json";
export { Memo, Operation, Address, nativeToScVal, USDC, NETWORK };
export const server = new rpc.Server(RPC_URL);
export const horizon = new Horizon.Server(HORIZON_URL);
export const addr = (v: string) => new Address(v).toScVal();
export const num = (v: string | bigint) =>
  nativeToScVal(BigInt(v), { type: "i128" });
export const u32 = (v: number) => nativeToScVal(v, { type: "u32" });
export const str = (v: string) => nativeToScVal(v, { type: "string" });
export const bytes = (v: Uint8Array) => nativeToScVal(v);
export const hex = (v: Uint8Array) =>
  Array.from(v, (b) => b.toString(16).padStart(2, "0")).join("");
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
export const txUrl = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const contractUrl = (id: string) =>
  `https://stellar.expert/explorer/testnet/contract/${id}`;
export const short = (v: string) => `${v.slice(0, 5)}…${v.slice(-5)}`;
export type Receipt = { hash: string; value?: any; ledger: number };
type SavedTx = { hash: string; envelope: string; result?: Receipt };

export async function read(
  id: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<any> {
  const tx = new TransactionBuilder(new Account(USDC_ISSUER, "0"), {
    networkPassphrase: NETWORK,
    fee: "100",
  })
    .addOperation(new Contract(id).call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result)
    throw new Error(
      `${method}: ${"error" in result ? result.error : "No response"}`,
    );
  return scValToNative(result.result.retval);
}

// Call under exclusive(). Save the exact signed envelope before submission.
// A reload or timeout reuses it, never builds a second payment for this intent.
export async function send(
  signer: Signer,
  operation: xdr.Operation,
  intent: string,
  options: { classic?: boolean; memo?: Memo } = {},
): Promise<Receipt> {
  const key = `tx:${signer.publicKey()}:${intent}`;
  let saved = load<SavedTx | null>(key, null);
  if (saved?.result) return saved.result;
  if (!saved) {
    const network = await server.getNetwork();
    if (network.passphrase !== NETWORK)
      throw new Error("Unexpected Stellar network.");
    const source = await horizon.loadAccount(signer.publicKey());
    let builder = new TransactionBuilder(source, {
      fee: "10000",
      networkPassphrase: NETWORK,
    })
      .addOperation(operation)
      .setTimeout(180);
    if (options.memo) builder = builder.addMemo(options.memo);
    let tx = builder.build();
    if (!options.classic) tx = await server.prepareTransaction(tx);
    const unsignedHash = hex(tx.hash());
    const signed = TransactionBuilder.fromXDR(
      await signer.signTransaction(tx.toXDR()),
      NETWORK,
    );
    if (hex(signed.hash()) !== unsignedHash)
      throw new Error("Wallet changed the requested transaction.");
    saved = { hash: unsignedHash, envelope: signed.toXDR() };
    save(key, saved);
  }
  const tx = TransactionBuilder.fromXDR(saved.envelope, NETWORK);
  if (hex(tx.hash()) !== saved.hash)
    throw new Error("Saved transaction hash mismatch.");
  const confirm = (result: rpc.Api.GetSuccessfulTransactionResponse) => {
    const receipt = {
      hash: saved!.hash,
      ledger: result.ledger,
      value: result.returnValue ? scValToNative(result.returnValue) : undefined,
    };
    save(key, { ...saved, result: receipt });
    return receipt;
  };
  const prior = await server.getTransaction(saved.hash);
  if (prior.status === "SUCCESS") return confirm(prior);
  if (prior.status === "FAILED")
    throw new Error(
      `Transaction failed. Inspect ${txUrl(saved.hash)} before opening another payment.`,
    );
  const accepted = await server.sendTransaction(tx);
  if (!["PENDING", "DUPLICATE", "TRY_AGAIN_LATER"].includes(accepted.status)) {
    throw new Error(
      `Transaction rejected (${accepted.status}). Saved receipt: ${txUrl(saved.hash)}`,
    );
  }
  for (let i = 0; i < 60; i++) {
    const result = await server.getTransaction(saved.hash);
    if (result.status === "SUCCESS") return confirm(result);
    if (result.status === "FAILED")
      throw new Error(`Transaction failed: ${txUrl(saved.hash)}`);
    await delay(2000);
  }
  throw new Error(
    `Confirmation pending. Resume this action: ${txUrl(saved.hash)}`,
  );
}
export const call = (
  signer: Signer,
  id: string,
  method: string,
  args: xdr.ScVal[],
  intent: string,
) => send(signer, new Contract(id).call(method, ...args), intent);
export async function trustline(signer: Signer) {
  const account = await horizon.loadAccount(signer.publicKey());
  if (
    !account.balances.some(
      (b) =>
        "asset_code" in b &&
        b.asset_code === "USDC" &&
        b.asset_issuer === USDC_ISSUER,
    )
  ) {
    await send(signer, Operation.changeTrust({ asset: USDC }), "trustline", {
      classic: true,
    });
  }
}
export async function walletBalance(account: string) {
  try {
    const record = await horizon.loadAccount(account);
    return (
      record.balances.find(
        (b) =>
          "asset_code" in b &&
          b.asset_code === "USDC" &&
          b.asset_issuer === USDC_ISSUER,
      )?.balance ?? "0"
    );
  } catch (e: any) {
    if (e.response?.status === 404) return "0";
    throw e;
  }
}
export interface Config {
  name: string;
  admin: string;
  token: string;
  dues_try: bigint;
  quorum: number;
  vault: string | null;
}
export interface Proposal {
  id: number;
  proposer: string;
  payee: string;
  amount: bigint;
  description: string;
  status: string;
  approvals: string[];
  created_at: number;
}
export interface Activity {
  id: string;
  type: string;
  amount?: bigint;
  member?: string;
  proposalId?: number;
  hash: string;
  date: string;
}
export interface Snapshot {
  config: Config;
  members: string[];
  liquid: bigint;
  vaulted: bigint;
  total: bigint;
  proposals: Proposal[];
  contributions: Record<string, bigint>;
  ledger: number;
}
const verified = new Set<string>();
async function verifyTreasury(id: string) {
  if (verified.has(id)) return;
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
  const result = await server.getLedgerEntries(key);
  const entry = result.entries[0];
  if (!entry || entry.val.type !== "contractData")
    throw new Error("Treasury is unavailable. Stellar testnet may have reset.");
  const instance = entry.val.contractData.val;
  if (instance.type !== "scvContractInstance")
    throw new Error("Treasury instance is malformed.");
  const executable = instance.instance.executable;
  if (
    executable.type !== "contractExecutableWasm" ||
    hex(executable.wasmHash.value) !== deployment.wasmHash
  )
    throw new Error(
      "This invitation does not point to a verified Duly treasury.",
    );
  verified.add(id);
}
export async function snapshot(id: string): Promise<Snapshot> {
  await verifyTreasury(id);
  const [config, members, liquid, vaulted, total, count, ledger] =
    await Promise.all([
      read(id, "config"),
      read(id, "members"),
      read(id, "liquid_balance"),
      read(id, "vault_balance"),
      read(id, "balance"),
      read(id, "proposal_count"),
      server.getLatestLedger(),
    ]);
  if (config.vault !== deployment.vault)
    throw new Error("This treasury does not use the verified Duly reserve.");
  const ids = Array.from({ length: Math.min(count, 50) }, (_, i) => count - i);
  const [proposals, contributions] = await Promise.all([
    Promise.all(
      ids.map(async (n) => {
        const [p, approvals] = await Promise.all([
          read(id, "proposal", [u32(n)]),
          read(id, "approvals", [u32(n)]),
        ]);
        return {
          ...p,
          status: Array.isArray(p.status) ? p.status[0] : p.status,
          approvals,
        };
      }),
    ),
    Promise.all(
      members.map(async (m: string) => [
        m,
        await read(id, "contribution", [addr(m)]),
      ]),
    ),
  ]);
  return {
    config,
    members,
    liquid,
    vaulted,
    total,
    proposals,
    contributions: Object.fromEntries(contributions),
    ledger: ledger.sequence,
  };
}
export async function activity(
  id: string,
  latest: number,
): Promise<Activity[]> {
  const events: rpc.Api.EventResponse[] = [];
  let cursor: string | undefined;
  // RPC may stop its ledger scan and return an empty page with a cursor.
  // Continue until the cursor reaches our snapshot, not until the first empty page.
  for (let page = 0; page < 8; page++) {
    const response = await server.getEvents({
      ...(cursor ? { cursor } : { startLedger: Math.max(1, latest - 15000) }),
      filters: [{ type: "contract", contractIds: [id] }],
      limit: 200,
    });
    events.push(...response.events);
    if (!response.cursor || response.cursor === cursor) break;
    cursor = response.cursor;
    if (Number(BigInt(cursor.split("-")[0]) >> 32n) >= latest) break;
  }
  return events
    .filter((e) => e.inSuccessfulContractCall)
    .map((e) => {
      const topics = e.topic.map(scValToNative);
      const v = scValToNative(e.value);
      return {
        id: e.id,
        type: String(topics[0]),
        amount: v.amount,
        member:
          v.member ?? (typeof topics[1] === "string" ? topics[1] : undefined),
        proposalId: typeof topics[1] === "number" ? topics[1] : undefined,
        hash: e.txHash,
        date: e.ledgerClosedAt,
      };
    })
    .reverse();
}
export async function rates(): Promise<{
  mid: number;
  buy: number;
  sell: number;
  time: string;
}> {
  const response = await fetch(`${ANCHOR}/health`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Rate service is unavailable.");
  const health = await response.json();
  if (health.network_passphrase !== NETWORK || health.environment !== "sandbox")
    throw new Error("Unexpected anchor environment.");
  const values = [
    health.rates.mid_rate,
    health.rates.buy_rate,
    health.rates.sell_rate,
  ].map(Number);
  if (values.some((v) => !Number.isFinite(v) || v <= 0))
    throw new Error("Invalid exchange rate.");
  return { mid: values[0], buy: values[1], sell: values[2], time: health.time };
}
