import {
  createHash,
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import deploymentManifest from "../src/building-deployment.json" with { type: "json" };
import {
  Account,
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  inspectAuthEntry,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@duly/stellar-sdk";
import {
  NETWORK,
  RPC_URL,
  HORIZON_URL,
  TOKEN,
  USDC_ISSUER,
} from "../../scripts/lib/config.mjs";
const USDC = new Asset("USDC", USDC_ISSUER);

export {
  Address,
  Contract,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
  NETWORK,
  TOKEN,
  USDC,
  USDC_ISSUER,
};
export const server = new rpc.Server(RPC_URL);
export const horizon = new Horizon.Server(HORIZON_URL);
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const addr = (value) => new Address(value).toScVal();
export const bytes = (value) => nativeToScVal(Buffer.from(value, "hex"));
export const amount = (value) => nativeToScVal(BigInt(value), { type: "i128" });
export const uint = (value) => nativeToScVal(value, { type: "u32" });
export const uint64 = (value) => nativeToScVal(BigInt(value), { type: "u64" });
export const struct = (value) =>
  xdr.ScVal.scvMap(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, val]) =>
          new xdr.ScMapEntry({
            key: nativeToScVal(key, { type: "symbol" }),
            val,
          }),
      ),
  );
export const stringify = (value) =>
  JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function bankKey() {
  if (!process.env.DULY_BANK_SECRET)
    throw new Error("Duly testnet bank/fee sponsor is not configured.");
  return Keypair.fromSecret(process.env.DULY_BANK_SECRET);
}
export function derivedKey(scope) {
  return Keypair.fromRawEd25519Seed(
    createHmac("sha256", bankKey().rawSecretKey())
      .update(`duly:testnet:v3:${scope}`)
      .digest(),
  );
}
export function seal(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    createHash("sha256").update(bankKey().rawSecretKey()).digest(),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal(value) {
  if (typeof value !== "string" || value.length > 90_000)
    throw new Error("Invalid saved bank reference.");
  const raw = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(bankKey().rawSecretKey()).digest(),
    raw.subarray(0, 12),
  );
  cipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString(),
  );
}
export async function assertNetwork() {
  if ((await server.getNetwork()).passphrase !== NETWORK)
    throw new Error("Only Stellar testnet is supported.");
}
export async function read(id, method, args = []) {
  const tx = new TransactionBuilder(new Account(USDC_ISSUER, "0"), {
    networkPassphrase: NETWORK,
    fee: "100",
  })
    .addOperation(new Contract(id).call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result)
    throw new Error(`${method}: ${result.error ?? "No result"}`);
  return scValToNative(result.result.retval);
}
export async function wasmHash(id) {
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  );
  const result = await server.getLedgerEntries(key);
  if (!result.entries[0]) throw new Error("Contract is unavailable.");
  return Buffer.from(
    result.entries[0].val.contractData.val.instance.executable.wasmHash.value,
  ).toString("hex");
}
export async function manifest() {
  return deploymentManifest;
}
export async function building(id) {
  if (typeof id !== "string" || !/^C[A-Z2-7]{55}$/.test(id))
    throw new Error("Invalid building.");
  const deployment = await manifest();
  if (
    ![
      deployment.wasmHash,
      deployment.demoWasmHash,
      ...(deployment.priorWasmHashes ?? []),
    ].includes(await wasmHash(id))
  )
    throw new Error("Unsupported Duly building code.");
  const cfg = await read(id, "config");
  if (cfg.bank !== bankKey().publicKey() || cfg.token !== TOKEN)
    throw new Error("Building uses a different bank or token.");
  return cfg;
}
export async function funded(key, withUsdc = false) {
  let account;
  try {
    account = await horizon.loadAccount(key.publicKey());
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${key.publicKey()}`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok)
      throw new Error("Testnet fee funding is temporarily unavailable.");
    account = await horizon.loadAccount(key.publicKey());
  }
  if (
    withUsdc &&
    !account.balances.some(
      (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
    )
  ) {
    await submit(
      await signed(key, Operation.changeTrust({ asset: USDC }), {
        classic: true,
      }),
    );
  }
  return account;
}
export async function signed(
  key,
  operation,
  { classic = false, memo, timeout = 180 } = {},
) {
  const source = await horizon.loadAccount(key.publicKey());
  let builder = new TransactionBuilder(source, {
    networkPassphrase: NETWORK,
    fee: "10000",
  })
    .addOperation(operation)
    .setTimeout(timeout);
  if (memo) builder = builder.addMemo(memo);
  let tx = builder.build();
  if (!classic) tx = await server.prepareTransaction(tx);
  if (BigInt(tx.fee) > 50_000_000n)
    throw new Error("Testnet transaction exceeds the sponsor fee limit.");
  tx.sign(key);
  return { envelope: tx.toXDR(), hash: Buffer.from(tx.hash()).toString("hex") };
}
export async function submit(saved) {
  const tx = TransactionBuilder.fromXDR(saved.envelope, NETWORK);
  const id = Buffer.from(tx.hash()).toString("hex");
  if (id !== saved.hash) throw new Error("Transaction reference mismatch.");
  let found = await server.getTransaction(id);
  if (found.status === "SUCCESS")
    return {
      hash: id,
      ledger: found.ledger,
      value: found.returnValue ? scValToNative(found.returnValue) : undefined,
    };
  if (found.status === "FAILED") throw new Error(`Transaction failed: ${id}`);
  const sent = await server.sendTransaction(tx);
  if (!["PENDING", "DUPLICATE", "TRY_AGAIN_LATER"].includes(sent.status))
    throw new Error(`Transaction rejected: ${id} (${sent.status})`);
  for (let i = 0; i < 25; i++) {
    await delay(1200);
    found = await server.getTransaction(id);
    if (found.status === "SUCCESS")
      return {
        hash: id,
        ledger: found.ledger,
        value: found.returnValue ? scValToNative(found.returnValue) : undefined,
      };
    if (found.status === "FAILED") throw new Error(`Transaction failed: ${id}`);
  }
  return { hash: id, pending: true };
}

// Deterministic, isolated fee channels remove shared-source sequence races.
// The channel is unique to the signed request. Soroban transactions have no
// memo; reconcile the exact successful invocation from this channel's history.
export async function relayFunction(func, auth, { signer, scope } = {}) {
  await assertNetwork();
  const requestHash = hash(
    scope ??
      stringify({
        func: func.toXdr("base64"),
        auth: auth.map((a) => a.toXdr("base64")),
      }),
  );
  const channel = derivedKey(`fee:${requestHash}`);
  await funded(channel);
  const history = await horizon
    .transactions()
    .forAccount(channel.publicKey())
    .order("desc")
    .limit(50)
    .call();
  const prior = history.records.find((t) => {
    if (!t.successful || t.source_account !== channel.publicKey()) return false;
    const transaction = TransactionBuilder.fromXDR(t.envelope_xdr, NETWORK);
    const operation = transaction.operations[0];
    return (
      transaction.operations.length === 1 &&
      operation.type === "invokeHostFunction" &&
      operation.func.toXdr("base64") === func.toXdr("base64")
    );
  });
  if (prior) return { hash: prior.hash, ledger: prior.ledger };
  const account = await horizon.loadAccount(channel.publicKey());
  let tx = new TransactionBuilder(account, {
    networkPassphrase: NETWORK,
    fee: "10000",
  })
    .addOperation(Operation.invokeHostFunction({ func, auth }))
    .setTimeout(0)
    .build();
  if (signer) {
    const simulation = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result)
      throw new Error(simulation.error ?? "Simulation failed.");
    const expires = simulation.latestLedger + 720;
    auth = await Promise.all(
      simulation.result.auth.map((entry) => {
        const info = inspectAuthEntry(entry);
        if (info.address !== signer.publicKey())
          throw new Error("Unexpected bank authorization request.");
        return authorizeEntry(entry, signer, expires, NETWORK);
      }),
    );
    const source = await horizon.loadAccount(channel.publicKey());
    tx = new TransactionBuilder(source, {
      networkPassphrase: NETWORK,
      fee: "10000",
    })
      .addOperation(Operation.invokeHostFunction({ func, auth }))
      .setTimeout(0)
      .build();
  }
  tx = await server.prepareTransaction(tx);
  if (BigInt(tx.fee) > 50_000_000n)
    throw new Error("Sponsor fee limit exceeded.");
  tx.sign(channel);
  return submit({
    envelope: tx.toXDR(),
    hash: Buffer.from(tx.hash()).toString("hex"),
  });
}
export async function bankCall(id, method, args, scope) {
  const operation = new Contract(id).call(method, ...args);
  return relayFunction(operation.body.invokeHostFunctionOp.hostFunction, [], {
    signer: bankKey(),
    scope,
  });
}
export async function body(req) {
  if (req.method !== "POST") throw new Error("POST required.");
  if (
    typeof req.headers?.["content-type"] !== "string" ||
    !req.headers["content-type"].startsWith("application/json")
  )
    throw new Error("JSON required.");
  let raw = req.body;
  if (raw === undefined) {
    raw = "";
    for await (const part of req) {
      raw += part;
      if (Buffer.byteLength(raw) > 128_000)
        throw new Error("Request too large.");
    }
  }
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (
    Buffer.byteLength(typeof raw === "string" ? raw : JSON.stringify(raw)) >
    128_000
  )
    throw new Error("Request too large.");
  const result = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!result || Array.isArray(result) || typeof result !== "object")
    throw new Error("A JSON object is required.");
  return result;
}
export function reply(res, value, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(stringify(value));
}
