import { randomUUID } from "node:crypto";
import { StrKey } from "@duly/stellar-sdk";
import { AnchorClient } from "../../scripts/lib/anchor.mjs";
import { ANCHOR } from "../../scripts/lib/config.mjs";
import { fromUnits, toUnits } from "../../scripts/lib/amounts.mjs";
import { deposit, resumeDeposit } from "./bank.mjs";
import { JournalConflict, readJournal, writeJournal } from "./journal.mjs";
import {
  NETWORK,
  Operation,
  TransactionBuilder,
  assertNetwork,
  bankKey,
  body,
  building,
  derivedKey,
  funded,
  hash,
  horizon,
  read,
  reply,
  scValToNative,
  seal,
  server,
  submit,
  uint,
  unseal,
} from "./runtime.mjs";

const indexKey = (treasury) => derivedKey(`dues-index:${treasury}`);
const decode = (value) => Buffer.from(value, "base64").toString();
const receiptPattern = /^[a-f0-9]{64}$/;

export function decodePayment(id, value) {
  const [seat, amountTry, amountUsdc, paidAt, method] = JSON.parse(value);
  if (
    !receiptPattern.test(id) ||
    !Number.isSafeInteger(seat) ||
    seat < 1 ||
    !/^\d+$/.test(amountTry) ||
    !/^\d+$/.test(amountUsdc) ||
    !Number.isSafeInteger(paidAt) ||
    paidAt < 1 ||
    ![0, 1].includes(method)
  )
    throw new Error("Invalid dues ledger entry; reconciliation is required.");
  return {
    hash: id,
    seat,
    amountTry,
    amountUsdc,
    paidAt,
    method: method ? "USDC" : "TRY",
  };
}

async function ledgerAccount(treasury) {
  try {
    return await horizon.loadAccount(indexKey(treasury).publicKey());
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}
async function ledger(treasury) {
  await building(treasury);
  const account = await ledgerAccount(treasury);
  return {
    address: indexKey(treasury).publicKey(),
    payments: Object.entries(account?.data_attr ?? {})
      .filter(([name]) => receiptPattern.test(name))
      .map(([name, value]) => decodePayment(name, decode(value)))
      .sort((a, b) => b.paidAt - a.paidAt || a.hash.localeCompare(b.hash)),
  };
}

// Only successful, uniquely identified contribution events emitted by the
// verified treasury can reduce dues. Token transfers alone are insufficient.
export function validateContribution(result, expected) {
  if (result.status !== "SUCCESS")
    throw new Error("Contribution is not confirmed.");
  const matches = (result.events?.contractEventsXdr ?? [])
    .flat()
    .filter(
      (event) =>
        event.contractId &&
        StrKey.encodeContract(event.contractId.value) === expected.treasury &&
        event.body.type === "v0" &&
        scValToNative(event.body.v0.topics[0]) === "contribution_recorded",
    );
  if (matches.length !== 1)
    throw new Error("A unique treasury contribution receipt is required.");
  const event = matches[0],
    value = scValToNative(event.body.v0.data);
  if (
    scValToNative(event.body.v0.topics[1]) !== expected.seat ||
    value.payer !== expected.account ||
    value.amount !== BigInt(expected.amountUsdc)
  )
    throw new Error("Receipt does not match this apartment, payer and amount.");
  const paidAt = Number(result.createdAt);
  if (!Number.isSafeInteger(paidAt) || paidAt < 1)
    throw new Error("Receipt time is unavailable.");
  if (
    expected.createdAt &&
    (paidAt < expected.createdAt - 5 || paidAt > expected.expiresAt)
  )
    throw new Error(
      "The contribution was outside its saved exchange-rate window.",
    );
  return paidAt;
}

async function quote(request) {
  await building(request.treasury);
  if (!(
    StrKey.isValidEd25519PublicKey(request.account) ||
    StrKey.isValidContract(request.account)
  ))
    throw new Error("Invalid payer address.");
  await read(request.treasury, "seat", [uint(request.seat)]);
  const usdc = toUnits(request.amount);
  if (usdc <= 0n || usdc > 10000n * 10000000n)
    throw new Error("Enter between one stroop and 10,000 test USDC.");
  const response = await fetch(`${ANCHOR}/health`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("The exchange rate is unavailable.");
  const health = await response.json();
  if (health.network_passphrase !== NETWORK || health.environment !== "sandbox")
    throw new Error("Unexpected rate provider.");
  const rate = toUnits(Number(health.rates.sell_rate).toFixed(7));
  if (rate <= 0n) throw new Error("Invalid exchange rate.");
  const amountTry = (usdc * rate * 100n) / 100000000000000n;
  const createdAt = Math.floor(Date.now() / 1000);
  const flow = {
    kind: "dues-credit",
    treasury: request.treasury,
    account: request.account,
    seat: request.seat,
    amountUsdc: usdc.toString(),
    amountTry: amountTry.toString(),
    createdAt,
    expiresAt: createdAt + 600,
    claim: randomUUID(),
    method: "USDC",
  };
  return {
    saved: seal(flow),
    amountUsdc: fromUnits(usdc),
    amountTry: fromUnits(amountTry, 2),
    expiresAt: new Date(flow.expiresAt * 1000).toISOString(),
  };
}

async function expectations(saved) {
  const flow = unseal(saved);
  if (flow.kind === "dues-credit") return flow;
  if (flow.version !== 3 || flow.kind !== "deposit")
    throw new Error("Unsupported contribution reference.");
  // For TRY, credit the actual gross bank payment once; fees never rewrite it.
  const anchor = await new AnchorClient(derivedKey(flow.scope)).discover();
  const settled = await anchor.transaction(flow.order.id);
  if (settled.status !== "completed" || !settled.stellar_transaction_id)
    throw new Error("The bank deposit has not settled.");
  return {
    treasury: flow.treasury,
    account: flow.account,
    seat: flow.seat,
    amountUsdc: toUnits(settled.amount_out).toString(),
    amountTry: toUnits(flow.amount, 2).toString(),
    claim: flow.scope,
    method: "TRY",
  };
}

export async function recordDues(request) {
  if (!receiptPattern.test(request.receipt))
    throw new Error("Invalid contribution receipt.");
  await building(request.treasury);
  // Existing indexed receipts remain readable after RPC's finite retention window.
  let account = await ledgerAccount(request.treasury);
  if (account?.data_attr[request.receipt])
    return decodePayment(
      request.receipt,
      decode(account.data_attr[request.receipt]),
    );
  const expected = await expectations(request.saved);
  if (expected.treasury !== request.treasury)
    throw new Error("Wrong building for this payment.");
  const result = await server.getTransaction(request.receipt);
  const paidAt = validateContribution(result, expected);
  const row = JSON.stringify([
    expected.seat,
    expected.amountTry,
    expected.amountUsdc,
    paidAt,
    expected.method === "USDC" ? 1 : 0,
  ]);
  if (Buffer.byteLength(row) > 64)
    throw new Error("Payment is too large for this dues ledger.");
  const claimName = `q:${hash(expected.claim).slice(0, 56)}`,
    key = indexKey(request.treasury);
  await funded(key);
  for (let attempt = 0; attempt < 5; attempt++) {
    account = await horizon.loadAccount(key.publicKey());
    const claim = account.data_attr[claimName];
    if (claim && decode(claim) !== request.receipt)
      throw new Error("This payment reference has already been credited.");
    if (account.data_attr[request.receipt])
      return decodePayment(
        request.receipt,
        decode(account.data_attr[request.receipt]),
      );
    // Receipt + quote/bank-order claim are written atomically. No mutable running
    // total is incremented, so an uncertain response cannot double-credit dues.
    const tx = new TransactionBuilder(account, {
      networkPassphrase: NETWORK,
      fee: "10000",
    })
      .setTimeout(180)
      .addOperation(Operation.manageData({ name: request.receipt, value: row }))
      .addOperation(
        Operation.manageData({ name: claimName, value: request.receipt }),
      )
      .addOperation(
        Operation.manageData({
          name: "duly:building",
          value: request.treasury,
        }),
      )
      .addOperation(
        Operation.manageData({
          name: "duly:bank",
          value: bankKey().publicKey(),
        }),
      )
      .build();
    tx.sign(key);
    try {
      const receipt = await submit({
        envelope: tx.toXDR(),
        hash: Buffer.from(tx.hash()).toString("hex"),
      });
      if (!receipt.pending) return decodePayment(request.receipt, row);
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error(
    "Dues indexing is pending. Resume the same contribution; do not pay again.",
  );
}

async function demoFunds(request) {
  const config = await building(request.treasury);
  if (!config.demo || request.account !== config.manager)
    throw new Error("Test funding is only available to the solo demo account.");
  const scope = `dues-demo-funds:${request.treasury}`;
  let journal = await readJournal(scope),
    record = journal?.value?.record;
  if (!record)
    record = await deposit({
      treasury: request.treasury,
      account: request.account,
      seat: 1,
      amount: "500",
    });
  else if (record.phase !== "complete") {
    record = { ...record, ...(await resumeDeposit(unseal(record.saved))) };
    if (record.phase === "contribute") record.phase = "complete";
  }
  try {
    journal = await writeJournal(scope, { record }, journal?.version);
  } catch (error) {
    if (!(error instanceof JournalConflict)) throw error;
    journal = await readJournal(scope);
  }
  if (!journal?.value?.record)
    throw new Error("Demo funding is pending; resume the same request.");
  const current = journal.value.record;
  return {
    phase: current.phase,
    amountUsdc: current.amountUsdc,
    receipt: current.receipt,
  };
}

export default async function handler(req, res) {
  try {
    const request = await body(req);
    await assertNetwork();
    if (request.action === "ledger")
      return reply(res, await ledger(request.treasury));
    if (request.action === "quote") return reply(res, await quote(request));
    if (request.action === "record")
      return reply(res, await recordDues(request));
    if (request.action === "demo-funds")
      return reply(res, await demoFunds(request));
    throw new Error("Unknown dues action.");
  } catch (error) {
    return reply(res, { error: error.message }, 400);
  }
}
