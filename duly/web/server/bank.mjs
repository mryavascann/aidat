import { randomUUID } from "node:crypto";
import {
  JournalConflict,
  queueScope,
  readJournal,
  writeJournal,
  queueIndex,
  removeIndex,
} from "./journal.mjs";
import { AnchorClient, STELLAR_USDC } from "../../scripts/lib/anchor.mjs";
import { toUnits, fromUnits } from "../../scripts/lib/amounts.mjs";
import { normalizeIban, recipientId } from "../../scripts/lib/iban.mjs";
import {
  Contract,
  Memo,
  Operation,
  addr,
  amount,
  assertNetwork,
  bankCall,
  bankKey,
  body,
  building,
  bytes,
  derivedKey,
  funded,
  hash,
  read,
  reply,
  seal,
  server,
  signed,
  struct,
  submit,
  TOKEN,
  uint,
  uint64,
  unseal,
  USDC,
  USDC_ISSUER,
} from "./runtime.mjs";

const hex = (value) => Buffer.from(value).toString("hex");
const status = (value) => (Array.isArray(value) ? value[0] : value);
const preparedQuote = (expense) =>
  expense.quote?.[0] === "Prepared" ? expense.quote[1] : null;

// Pause before creating a bank order or attempting a doomed contract call.
// Existing orders keep their original recipient, quote and idempotency key.
export function expensePaymentBlock(
  expense,
  balance,
  ledger,
  now = Date.now(),
) {
  if (status(expense.status) !== "Pending") return null;
  const quote = preparedQuote(expense);
  if (
    quote &&
    (ledger >= quote.expires_at || now >= Number(quote.expires_time) * 1000)
  )
    return { phase: "needs-review", reason: "QUOTE_EXPIRED" };
  const required = quote?.amount_usdc ?? expense.max_usdc;
  if (balance < required)
    return {
      phase: "awaiting-funds",
      reason: "INSUFFICIENT_TREASURY_BALANCE",
      availableUsdc: fromUnits(balance),
      requiredUsdc: fromUnits(required),
    };
  return null;
}

async function anchorFor(scope, iban) {
  const key = derivedKey(scope);
  await funded(key, true);
  const anchor = await new AnchorClient(key).discover();
  if (iban) {
    await anchor.request(`${anchor.toml.KYC_SERVER}/customer`, {
      method: "PUT",
      body: JSON.stringify({ bank_account_number: normalizeIban(iban) }),
    });
    const customer = await anchor.request(`${anchor.toml.KYC_SERVER}/customer`);
    const echoed = customer.provided_fields?.bank_account_number?.value;
    if (echoed && normalizeIban(echoed) !== normalizeIban(iban))
      throw new Error("Bank recipient differs from the approved IBAN.");
  }
  return { anchor, key };
}

async function checkExpense(request) {
  const cfg = await building(request.treasury);
  if (!Number.isSafeInteger(request.id) || request.id < 1)
    throw new Error("Invalid expense.");
  const expense = await read(request.treasury, "expense", [uint(request.id)]);
  if (
    request.iban &&
    (await recipientId(request.iban)) !== hex(expense.recipient)
  )
    throw new Error("This IBAN does not match the approved expense.");
  return { cfg, expense };
}

async function withdrawal(request) {
  const { expense } = await checkExpense(request);
  const iban = normalizeIban(request.iban);
  if (status(expense.status) !== "Pending")
    throw new Error("Resume the existing bank payment for this expense.");
  if (preparedQuote(expense))
    throw new Error(
      "A bank order is already attached. Resume its saved reference.",
    );
  const scope = `expense:${request.treasury}:${request.id}`;
  const { anchor, key } = await anchorFor(scope, iban);
  const quote = await anchor.request(
    `${anchor.toml.ANCHOR_QUOTE_SERVER}/quote`,
    {
      method: "POST",
      body: JSON.stringify({
        sell_asset: STELLAR_USDC,
        buy_asset: "iso4217:TRY",
        buy_amount: fromUnits(expense.amount_try, 2),
        context: "sep6",
        buy_delivery_method: "bank_account",
      }),
    },
  );
  if (
    quote.sell_asset !== STELLAR_USDC ||
    quote.buy_asset !== "iso4217:TRY" ||
    toUnits(quote.buy_amount, 2) !== expense.amount_try
  )
    throw new Error("Bank quote does not match the approved TRY amount.");
  const usdc = toUnits(quote.sell_amount);
  if (usdc <= 0n || usdc > expense.max_usdc)
    throw new Error("The bank quote exceeds the approved USDC ceiling.");
  if (Date.parse(quote.expires_at) <= Date.now())
    throw new Error("The bank quote expired.");
  if ((await read(request.treasury, "balance")) < usdc)
    throw new Error("INSUFFICIENT_TREASURY_BALANCE");
  const order = await anchor.request(
    `${anchor.toml.TRANSFER_SERVER}/withdraw?${new URLSearchParams({
      asset_code: "USDC",
      asset_issuer: USDC_ISSUER,
      account: key.publicKey(),
      amount: quote.sell_amount,
      funding_method: "bank_account",
      quote_id: quote.id,
    })}`,
  );
  if (
    !order.id ||
    order.memo_type !== "id" ||
    !/^\d+$/.test(String(order.memo)) ||
    !/^G[A-Z2-7]{55}$/.test(order.account_id)
  )
    throw new Error("Bank returned invalid routing instructions.");
  const flow = {
    version: 3,
    kind: "withdraw",
    treasury: request.treasury,
    id: request.id,
    iban,
    recipient: hex(expense.recipient),
    scope,
    account: key.publicKey(),
    quote,
    order,
    createdAt: new Date().toISOString(),
  };
  // The browser saves this token before attestation or any movement of funds.
  return {
    saved: seal(flow),
    phase: "quoted",
    amountTry: quote.buy_amount,
    amountUsdc: quote.sell_amount,
    iban,
    anchorId: order.id,
    expiresAt: quote.expires_at,
  };
}

async function resumeWithdrawal(flow, action) {
  const { expense } = await checkExpense(flow);
  if (
    flow.recipient !== hex(expense.recipient) ||
    (await recipientId(flow.iban)) !== flow.recipient
  )
    throw new Error("Saved recipient does not match the contract.");
  const { anchor, key } = await anchorFor(flow.scope, flow.iban);
  const orderHash = hash(flow.order.id);
  if (action === "attest") {
    if (status(expense.status) !== "Pending")
      return { phase: "disbursed", saved: seal(flow) };
    const attached = preparedQuote(expense);
    if (attached && hex(attached.order) === orderHash)
      return { phase: "attested", saved: seal(flow) };
    const current = await anchor.transaction(flow.order.id);
    if (
      current.status !== "pending_user_transfer_start" ||
      Date.parse(flow.quote.expires_at) <= Date.now()
    )
      throw new Error(
        "Check the saved bank order before signing. Its quote is no longer ready.",
      );
    const ledger = await server.getLatestLedger();
    const remaining = Math.floor(
      (Date.parse(flow.quote.expires_at) - Date.now()) / 1000,
    );
    const quote = struct({
      recipient: bytes(flow.recipient),
      order: bytes(orderHash),
      account: addr(flow.account),
      amount_try: amount(toUnits(flow.quote.buy_amount, 2)),
      amount_usdc: amount(toUnits(flow.quote.sell_amount)),
      expires_at: uint(
        ledger.sequence + Math.max(1, Math.floor(remaining / 5)),
      ),
      expires_time: uint64(
        Math.floor(Date.parse(flow.quote.expires_at) / 1000),
      ),
    });
    const result = await bankCall(
      flow.treasury,
      "prepare_payment",
      [uint(flow.id), quote],
      `attest:${flow.treasury}:${flow.id}:${orderHash}`,
    );
    return {
      phase: result.pending ? "attesting" : "attested",
      saved: seal(flow),
      receipt: result.hash,
    };
  }
  const attached = preparedQuote(expense);
  if (
    !attached ||
    hex(attached.order) !== orderHash ||
    attached.account !== key.publicKey()
  )
    throw new Error("Bank routing does not match the contract.");
  if (action === "execute" && status(expense.status) === "Pending") {
    const result = await bankCall(
      flow.treasury,
      "execute_expense",
      [uint(flow.id)],
      `execute:${flow.treasury}:${flow.id}:${orderHash}`,
    );
    return {
      phase: result.pending ? "attested" : "disbursed",
      saved: seal(flow),
      receipt: result.hash,
    };
  }
  if (!["Disbursed", "Settled"].includes(status(expense.status)))
    throw new Error("The approved expense has not funded this bank order.");
  let settlement = await anchor.transaction(flow.order.id);
  if (settlement.status !== "completed") {
    if (!flow.payment) {
      if (settlement.status !== "pending_user_transfer_start")
        return {
          phase: "processing",
          saved: seal(flow),
          bankStatus: settlement.status,
        };
      if (Date.parse(flow.quote.expires_at) <= Date.now())
        throw new Error(
          "The bank quote expired after funding. Keep this reference for reconciliation; no replacement transfer was sent.",
        );
      flow.payment = await signed(
        key,
        Operation.payment({
          destination: flow.order.account_id,
          asset: USDC,
          amount: fromUnits(toUnits(flow.quote.sell_amount)),
        }),
        { classic: true, memo: Memo.id(String(flow.order.memo)) },
      );
      return {
        phase: "bank-ready",
        saved: seal(flow),
        receipt: flow.payment.hash,
      };
    }
    const result = await submit(flow.payment);
    if (result.pending)
      return { phase: "processing", saved: seal(flow), receipt: result.hash };
    settlement = await anchor.transaction(flow.order.id);
    if (settlement.status !== "completed")
      return {
        phase: "processing",
        saved: seal(flow),
        bankStatus: settlement.status,
        receipt: result.hash,
      };
  }
  if (
    !settlement.external_transaction_id ||
    toUnits(settlement.amount_out, 2) !== toUnits(flow.quote.buy_amount, 2)
  )
    throw new Error(
      "Bank settlement needs reconciliation; do not create another payment.",
    );
  if (status(expense.status) !== "Settled") {
    const receipt = await bankCall(
      flow.treasury,
      "record_settlement",
      [
        uint(flow.id),
        bytes(orderHash),
        bytes(hash(settlement.external_transaction_id)),
      ],
      `settlement:${flow.treasury}:${flow.id}:${orderHash}`,
    );
    if (receipt.pending)
      return {
        phase: "recording",
        saved: seal(flow),
        bankReference: settlement.external_transaction_id,
      };
  }
  return {
    phase: "complete",
    saved: seal(flow),
    bankReference: settlement.external_transaction_id,
    amountTry: settlement.amount_out,
    iban: flow.iban,
    receipt: flow.payment?.hash ?? settlement.stellar_transaction_id,
    settlement: "simulated",
  };
}

export async function deposit(request) {
  await building(request.treasury);
  if (!/^[GC][A-Z2-7]{55}$/.test(request.account))
    throw new Error("Invalid contribution account.");
  await read(request.treasury, "seat", [uint(request.seat)]);
  const value = fromUnits(toUnits(request.amount, 2), 2);
  const scope = `deposit:${randomUUID()}`;
  const { anchor, key } = await anchorFor(scope);
  const order = await anchor.start("deposit", value);
  const flow = {
    version: 3,
    kind: "deposit",
    treasury: request.treasury,
    account: request.account,
    seat: request.seat,
    amount: value,
    scope,
    bridge: key.publicKey(),
    order,
  };
  return {
    saved: seal(flow),
    phase: "quoted",
    amountTry: value,
    amountUsdc: order.quote.buy_amount,
    anchorId: order.id,
    reference: order.instructions?.external_transfer_memo?.value,
  };
}

export async function resumeDeposit(flow) {
  await building(flow.treasury);
  const { anchor, key } = await anchorFor(flow.scope);
  let settlement = await anchor.transaction(flow.order.id);
  if (settlement.status === "pending_user_transfer_start") {
    if (Date.parse(flow.order.quote.expires_at) <= Date.now())
      throw new Error(
        "The saved deposit quote expired. Check this reference before starting another.",
      );
    await anchor.simulateDeposit(flow.order.id, flow.amount);
    settlement = await anchor.transaction(flow.order.id);
  }
  if (settlement.status !== "completed")
    return {
      saved: seal(flow),
      phase: "processing",
      bankStatus: settlement.status,
    };
  if (
    !settlement.stellar_transaction_id ||
    (settlement.amount_out_asset &&
      settlement.amount_out_asset !== STELLAR_USDC)
  )
    throw new Error("Deposit settlement is not verified.");
  if (!flow.transfer) {
    flow.transfer = await signed(
      key,
      new Contract(TOKEN).call(
        "transfer",
        addr(key.publicKey()),
        addr(flow.account),
        amount(toUnits(settlement.amount_out)),
      ),
    );
    return {
      saved: seal(flow),
      phase: "transfer-ready",
      receipt: flow.transfer.hash,
    };
  }
  const result = await submit(flow.transfer);
  return {
    saved: seal(flow),
    phase: result.pending ? "processing" : "contribute",
    amountUsdc: settlement.amount_out,
    receipt: result.hash,
    settlementHash: settlement.stellar_transaction_id,
    seat: flow.seat,
    account: flow.account,
    treasury: flow.treasury,
  };
}

function queueView(value) {
  const r = value.record ?? {};
  // Public keepers may advance a registered expense, but never receive the
  // decrypted IBAN or a token that can expose its private banking instructions.
  return {
    saved: "",
    phase: r.phase ?? value.phase ?? "scheduled",
    reason: null,
    availableUsdc: null,
    requiredUsdc: null,
    amountTry: r.amountTry,
    amountUsdc: r.amountUsdc,
    receipt: r.receipt,
    bankReference: r.bankReference,
    queued: true,
    kind: "withdraw",
    treasury: value.treasury,
    id: value.id,
    key: `expense:${value.treasury}:${value.id}`,
  };
}
export async function registerExpense(request) {
  const { expense } = await checkExpense(request);
  const iban = normalizeIban(request.iban),
    scope = queueScope(request.treasury, request.id);
  if ((await recipientId(iban)) !== hex(expense.recipient))
    throw new Error("IBAN does not match the expense.");
  let journal = await readJournal(scope);
  if (!journal?.value) {
    if (status(expense.status) !== "Pending")
      throw new Error("Resume the existing bank reference.");
    journal = await writeJournal(
      scope,
      {
        kind: "expense-queue",
        treasury: request.treasury,
        id: request.id,
        iban,
        record: null,
        phase: "scheduled",
      },
      journal?.version,
    );
  }
  await queueIndex(scope);
  return queueView(journal.value);
}
export async function advanceExpense(request) {
  const scope = queueScope(request.treasury, request.id);
  let journal = await readJournal(scope);
  if (!journal?.value)
    throw new Error(
      "Register the approved IBAN to enable automatic settlement.",
    );
  const value = journal.value;
  const { cfg, expense } = await checkExpense(value);
  if (value.record?.phase === "complete") {
    await removeIndex(scope);
    return queueView(value);
  }
  if (status(expense.status) === "Cancelled") {
    value.phase = "cancelled";
    await writeJournal(scope, value, journal.version);
    await removeIndex(scope);
    return queueView(value);
  }
  if (status(expense.status) === "Pending") {
    const [balance, ledger] = await Promise.all([
      read(value.treasury, "balance"),
      server.getLatestLedger(),
    ]);
    const block = expensePaymentBlock(expense, balance, ledger.sequence);
    if (block) return { ...queueView(value), ...block };
    if (
      value.record?.expiresAt &&
      Date.parse(value.record.expiresAt) <= Date.now()
    )
      return {
        ...queueView(value),
        phase: "needs-review",
        reason: "QUOTE_EXPIRED",
      };
  }
  if (!value.record) {
    const [tally, ledger] = await Promise.all([
      read(value.treasury, "expense_tally", [uint(value.id)]),
      server.getLatestLedger(),
    ]);
    const majority = tally[0] > Math.floor(cfg.seat_count / 2);
    if (
      !majority &&
      (expense.vetoed ||
        ledger.sequence < expense.ready_ledger ||
        Date.now() < Number(expense.ready_time) * 1000)
    )
      return queueView(value);
    value.record = await withdrawal(value);
  } else {
    const phase = value.record.phase;
    const action = ["quoted", "attesting"].includes(phase)
      ? "attest"
      : phase === "attested"
        ? "execute"
        : "resume";
    const flow = unseal(value.record.saved);
    value.record = {
      ...value.record,
      ...(await resumeWithdrawal(flow, action)),
    };
  }
  try {
    journal = await writeJournal(scope, value, journal.version);
  } catch (error) {
    if (!(error instanceof JournalConflict)) throw error;
    journal = await readJournal(scope);
  }
  if (journal.value.record?.phase === "complete") await removeIndex(scope);
  return queueView(journal.value);
}

export default async function handler(req, res) {
  try {
    const request = await body(req);
    await assertNetwork();
    if (request.action === "config")
      return reply(res, { bank: bankKey().publicKey(), network: "testnet" });
    let result;
    if (request.action === "register") result = await registerExpense(request);
    else if (request.action === "tick") result = await advanceExpense(request);
    else if (request.saved) {
      const flow = unseal(request.saved);
      if (flow.version !== 3) throw new Error("Unsupported bank reference.");
      result =
        flow.kind === "withdraw"
          ? await resumeWithdrawal(flow, request.action)
          : await resumeDeposit(flow);
    } else if (request.action === "deposit") result = await deposit(request);
    else throw new Error("A saved bank reference is required.");
    reply(res, result);
  } catch (error) {
    reply(res, { error: error.message }, 400);
  }
}
