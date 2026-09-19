import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Keypair, nativeToScVal } from "@duly/stellar-sdk";
import {
  call,
  readAs,
  address,
  i128,
  string,
  u32,
  resumeTransaction,
  json,
} from "../../scripts/lib/soroban.mjs";
import { recipientId } from "../../scripts/lib/iban.mjs";
import {
  readJournal,
  writeJournal,
  queueScope,
  JournalConflict,
} from "../server/journal.mjs";
import { settleQueue } from "../server/settle.mjs";
process.env.DULY_BANK_SECRET = (
  await readFile("../.duly-bank-v3-key", "utf8")
).trim();
const privateState = JSON.parse(
  await readFile("test-results/building-state.json", "utf8"),
);
const demo = JSON.parse(
  privateState.origins
    .flatMap((o) => o.localStorage)
    .find((v) => v.name === "duly:v3:demo").value,
);
const key = Keypair.fromSecret(demo.secrets[0]),
  treasury = demo.treasury,
  iban = "TR330006100519786457841326";
// A new solo building must never reuse another building's payment journal.
const flowPath = `test-results/queue-${treasury}.json`;
let flow;
try {
  flow = JSON.parse(await readFile(flowPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  flow = {};
}
const save = () => writeFile(flowPath, json(flow), { mode: 0o600 });
if (!flow.expense) {
  const receipt = flow.propose
    ? await resumeTransaction(flow.propose, "queue proposal")
    : await call(
        key,
        treasury,
        "propose_expense",
        [
          nativeToScVal(Buffer.from(await recipientId(iban), "hex")),
          i128(5000),
          i128(15000000),
          string("Automatic settlement QA"),
        ],
        {
          onSigned: async (signed) => {
            flow.propose = signed;
            await save();
          },
        },
      );
  flow.expense = Number(receipt.value);
  flow.propose = { ...flow.propose, result: receipt };
  await save();
}
const api = async (body) => {
  const r = await fetch(
    `${process.env.DULY_URL ?? "http://127.0.0.1:5174"}/api/bank`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const value = await r.json();
  if (!r.ok) throw new Error(value.error);
  return value;
};
const registered = await api({
  action: "register",
  treasury,
  id: flow.expense,
  iban,
});
assert.equal(registered.queued, true);
assert.equal(registered.iban, undefined);
assert.equal(registered.saved, "");
console.log("Durable, encrypted expense queue registered.");
const expense = await readAs(treasury, "expense", [u32(flow.expense)]);
if (Number(expense.ready_time) * 1000 > Date.now()) {
  const waiting = await api({ action: "tick", treasury, id: flow.expense });
  assert.equal(waiting.phase, "scheduled");
  await new Promise((r) =>
    setTimeout(
      r,
      Math.min(30000, Number(expense.ready_time) * 1000 - Date.now() + 6000),
    ),
  );
}
for (let i = 0; i < 3; i++) {
  let outcomes;
  if (process.argv.includes("--remote-keeper")) {
    const secret = (await readFile("../.duly-cron-v3-key", "utf8")).trim();
    const response = await fetch(`${process.env.DULY_URL}/api/settle`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    outcomes = result.results;
  } else outcomes = await settleQueue();
  console.log(outcomes);
  if (
    (await readAs(treasury, "expense", [u32(flow.expense)])).status[0] ===
    "Settled"
  )
    break;
}
assert.equal(
  (await readAs(treasury, "expense", [u32(flow.expense)])).status[0],
  "Settled",
);
const after = await readAs(treasury, "balance");
const repeated = await api({ action: "tick", treasury, id: flow.expense });
assert.equal(repeated.phase, "complete");
assert.equal(repeated.iban, undefined);
assert.equal(await readAs(treasury, "balance"), after);
const scope = queueScope(treasury, flow.expense),
  current = await readJournal(scope);
assert.equal(current.value.record.phase, "complete");
await assert.rejects(
  () => writeJournal(scope, current.value, "0"),
  JournalConflict,
);
assert.equal((await readJournal(scope)).value.record.phase, "complete");
await writeFile(
  "test-results/queue-proof.json",
  json({
    treasury,
    expense: flow.expense,
    amountTry: repeated.amountTry,
    amountUsdc: repeated.amountUsdc,
    receipt: repeated.receipt,
    bankReference: repeated.bankReference,
    proposalHash: flow.propose.result.hash,
    automatic: true,
    replaySafe: true,
  }),
);
console.log(
  "Automatic bank settlement, replay safety, stale-writer rejection and public IBAN privacy passed.",
);
