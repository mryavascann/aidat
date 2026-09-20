// Uses an isolated testnet demo for voting/cancellation. Bank responses are
// held in the browser, so no bank order or transfer is created by this test.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import {
  Keypair,
  nativeToScVal,
  TransactionBuilder,
  xdr,
} from "@duly/stellar-sdk";
import {
  call,
  readAs,
  address,
  i128,
  string,
  u32,
  resumeTransaction,
  NETWORK,
} from "../../scripts/lib/soroban.mjs";
import { recipientId } from "../../scripts/lib/iban.mjs";
import { seal } from "../server/runtime.mjs";

if (!process.argv.includes("--live"))
  throw new Error(
    "Use --live with the private demo-wallets fixture to authorize testnet voting/cancellation.",
  );
const base = process.env.DULY_URL ?? "http://localhost:5183";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "This fixture only runs locally",
);
const folder = "test-results/expense-cancellation";
await mkdir(folder, { recursive: true });
const state = JSON.parse(
  await readFile("test-results/demo-wallets/state.json", "utf8"),
);
const storage = state.origins.flatMap((origin) => origin.localStorage);
const demo = JSON.parse(
  storage.find((row) => row.name === "duly:v3:demo").value,
);
const treasury = demo.treasury,
  key = Keypair.fromSecret(demo.secrets[0]);
const iban = "TR330006100519786457841326",
  recipient = await recipientId(iban);
assert.equal((await readAs(treasury, "config")).manager, key.publicKey());
const beforeBalance = await readAs(treasury, "balance");
const journalPath = `${folder}/private-flow.json`;
let flow = await readFile(journalPath, "utf8")
  .then(JSON.parse)
  .catch((e) => {
    if (e.code !== "ENOENT") throw e;
    return {};
  });
const persist = async () => {
  await writeFile(journalPath, JSON.stringify(flow), { mode: 0o600 });
  await chmod(journalPath, 0o600);
};
async function once(name, method, args) {
  if (flow[name]?.result) return flow[name].result;
  const result = flow[name]
    ? await resumeTransaction(flow[name], method)
    : await call(key, treasury, method, args, {
        onSigned: async (signed) => {
          flow[name] = signed;
          await persist();
        },
      });
  flow[name] = { ...flow[name], result };
  await persist();
  return result;
}
const id = Number(
  (
    await once("proposal", "propose_expense", [
      nativeToScVal(Buffer.from(recipient, "hex")),
      i128(5000),
      i128(15000000),
      string("Cancellation and majority QA"),
    ])
  ).value,
);
if ((await readAs(treasury, "expense", [u32(id)])).status[0] === "Pending")
  await once("managerVote", "vote_expense", [
    u32(1),
    address(key.publicKey()),
    u32(id),
    nativeToScVal(true),
  ]);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const fixture = {
  key: `expense:${treasury}:${id}`,
  treasury,
  id,
  kind: "withdraw",
  phase: "attested",
  saved: "controlled-bank-reference",
  queued: false,
};
async function newContext(phase = "attested") {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  await context.addInitScript(
    ({ storage, fixture, recipient, iban }) => {
      if (localStorage.getItem("duly:test-expense-cancellation")) return;
      for (const { name, value } of storage) localStorage.setItem(name, value);
      localStorage.setItem("duly:test-expense-cancellation", "true");
      localStorage.setItem("duly:language", '"en"');
      localStorage.setItem("duly:v3:demo-active", "true");
      localStorage.setItem("duly:v3:bank", JSON.stringify([fixture]));
      localStorage.setItem(
        `duly:v3:iban:${fixture.treasury}:${recipient}`,
        JSON.stringify(iban),
      );
    },
    { storage, fixture: { ...fixture, phase }, recipient, iban },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
const idle = async (page) => {
  await page
    .locator(".progress-bar")
    .waitFor({ state: "hidden", timeout: 180000 });
  assert.equal(
    await page.locator(".error-box,.v3-modal-error").count(),
    0,
    (await page.locator(".error-box,.v3-modal-error").allTextContents()).join(
      "\n",
    ),
  );
};
const expenseCard = (page) =>
  page
    .locator(".v3-expense")
    .filter({ hasText: "Cancellation and majority QA" });
const navigate = async (page) => {
  await page.goto(base);
  await page.locator(".balance-value").waitFor();
  await page
    .locator("nav")
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  await expenseCard(page).waitFor();
};
const record = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("duly:v3:bank"))[0]);
let cancellationReceipt = await readFile(`${folder}/private-state.json`, "utf8")
  .then((value) => {
    const bank = JSON.parse(
      JSON.parse(value)
        .origins.flatMap((o) => o.localStorage)
        .find((row) => row.name === "duly:v3:bank").value,
    );
    return bank.find((row) => row.id === id)?.cancellationReceipt;
  })
  .catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
try {
  if ((await readAs(treasury, "expense", [u32(id)])).status[0] === "Pending") {
    const { context, page } = await newContext();
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    let calls = 0;
    await context.route("**/api/bank", async (route) => {
      calls++;
      assert.equal(route.request().postDataJSON().action, "execute");
      await waiting;
      await route.fulfill({
        json: {
          phase: "attested",
          saved: "late-attestation-reference",
          receipt: "a".repeat(64),
        },
      });
    });
    try {
      await navigate(page);
      assert.match(
        await expenseCard(page).locator(".v3-vote-count").innerText(),
        /[12]\/2 required approvals/,
      );
      await expenseCard(page)
        .getByRole("button", {
          name: "Simulate approvals needed for a majority",
          exact: true,
        })
        .click();
      await idle(page);
      const tally = await readAs(treasury, "expense_tally", [u32(id)]);
      assert.deepEqual(
        tally,
        [2, 0],
        "The simulator must stop at two approvals",
      );
      const voted = await readAs(treasury, "expense", [u32(id)]);
      assert.equal(
        voted.votes.length,
        2,
        "The third apartment does not need to vote",
      );
      assert(
        await expenseCard(page)
          .getByText("Majority reached", { exact: true })
          .isVisible(),
      );
      await expenseCard(page)
        .getByRole("button", { name: "Resume payment", exact: true })
        .click();
      for (const lang of ["TR", "EN"]) {
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: lang === "TR" ? "Close" : "Kapat",
            exact: true,
          })
          .click();
        await page.getByRole("button", { name: lang, exact: true }).click();
        await expenseCard(page)
          .getByRole("button", {
            name: lang === "TR" ? "Kaldığı yerden sürdür" : "Resume payment",
            exact: true,
          })
          .click();
        for (const width of [1440, 360])
          for (const theme of ["light", "dark"]) {
            await page.setViewportSize({ width, height: 1100 });
            await page.evaluate((t) => {
              document.documentElement.dataset.theme = t;
            }, theme);
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            );
            const audit = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze();
            assert.deepEqual(
              audit.violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => n.target),
              })),
              [],
            );
            await page.screenshot({
              path: `${folder}/${lang}-${width}-${theme}.png`,
            });
          }
      }
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Complete IBAN payment", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".v3-modal-status")
          ?.textContent.includes("Sending to the bank"),
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .waitFor({ state: "hidden", timeout: 1000 });
      assert(
        await page.locator(".progress-bar").isVisible(),
        "Keep the payment lock until the in-flight request resolves",
      );
      // Verify the manager cancellation really reached the deployed contract.
      for (let attempt = 0; attempt < 60; attempt++) {
        if (
          (await readAs(treasury, "expense", [u32(id)])).status[0] ===
          "Cancelled"
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      assert.equal(
        (await readAs(treasury, "expense", [u32(id)])).status[0],
        "Cancelled",
      );
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("duly:v3:bank"))[0].phase ===
          "cancelled",
      );
      release();
      await idle(page);
      const after = await record(page);
      assert.equal(after.phase, "cancelled");
      assert.equal(after.saved, "late-attestation-reference");
      assert(after.cancellationReceipt);
      cancellationReceipt = after.cancellationReceipt;
      assert.equal(calls, 1, "No next bank stage after cancellation");
      assert(
        await page
          .getByText(
            "Expense cancelled. No treasury payment will be made for this expense.",
            { exact: true },
          )
          .isVisible(),
      );
      assert.equal(await readAs(treasury, "balance"), beforeBalance);
      await page.reload();
      await page.locator(".balance-value").waitFor();
      assert.equal((await record(page)).phase, "cancelled");
      console.log(
        "Live testnet: 2 of 3 approvals, third voter unused; in-flight manager cancellation confirmed, balance unchanged, late receipt retained, reload persisted. Eight dialog accessibility scenarios passed.",
      );
    } finally {
      release();
      await context.storageState({ path: `${folder}/private-state.json` });
      await chmod(`${folder}/private-state.json`, 0o600);
      await context.close();
    }
  }
  // A valid saved route for the cancelled expense must exit before any anchor I/O.
  process.env.DULY_BANK_SECRET = (
    await readFile("../.duly-bank-v3-key", "utf8")
  ).trim();
  for (const action of ["attest", "execute", "resume"]) {
    const response = await fetch(`${base}/api/bank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        saved: seal({ version: 3, kind: "withdraw", treasury, id, iban }),
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, body.error);
    assert.equal(body.phase, "cancelled");
  }
  console.log(
    "Server refuses to advance cancelled saved withdrawals for all three resume actions.",
  );

  // A controlled Disbursed view exercises the irreversible side without sending funds.
  for (const closeWithX of [false, true]) {
    const { context, page } = await newContext("disbursed");
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    let bankCalls = 0,
      sent = 0;
    await context.route("**/api/bank", async (route) => {
      bankCalls++;
      assert.equal(route.request().postDataJSON().action, "resume");
      await waiting;
      await route.fulfill({
        json: {
          phase: "processing",
          saved: "same-sent-transfer",
          receipt: "b".repeat(64),
        },
      });
    });
    await context.route("**/soroban-testnet.stellar.org/**", async (route) => {
      const request = route.request().postDataJSON();
      if (request.method === "sendTransaction") {
        sent++;
        assert.fail("A sent transfer cannot be cancelled on chain");
      }
      if (request.method !== "simulateTransaction") return route.continue();
      const tx = TransactionBuilder.fromXDR(
        request.params.transaction,
        NETWORK,
      );
      const op = tx.operations[0];
      if (
        op.type !== "invokeHostFunction" ||
        op.func.type !== "hostFunctionTypeInvokeContract"
      )
        return route.continue();
      const fn = op.func.invokeContract;
      if (fn.functionName.toString() !== "expense") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      const value = xdr.ScVal.fromXdr(body.result.results[0].xdr, "base64");
      for (const entry of value.map)
        if (entry.key.sym.toString() === "status")
          entry.val = xdr.ScVal.scvVec([
            nativeToScVal("Disbursed", { type: "symbol" }),
          ]);
      body.result.results[0].xdr = value.toXdr("base64");
      await route.fulfill({ json: body });
    });
    try {
      await navigate(page);
      await expenseCard(page)
        .getByRole("button", { name: "Resume payment", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Complete IBAN payment", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".v3-modal-status")
          ?.textContent.includes("Sending to the bank"),
      );
      await page
        .getByRole("dialog")
        .getByRole("button", {
          name: closeWithX ? "Close" : "Stop waiting",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog")
        .waitFor({ state: "hidden", timeout: 1000 });
      release();
      await idle(page);
      assert.equal(sent, 0);
      assert.equal(bankCalls, 1);
      assert.equal((await record(page)).phase, "processing");
      assert.equal((await record(page)).receipt, "b".repeat(64));
      assert.equal((await record(page)).cancellationReceipt, undefined);
      assert(
        await page
          .getByText(
            "Waiting stopped; the payment is not marked cancelled. Any sent transfer is still tracked under the same expense.",
            { exact: true },
          )
          .isVisible(),
      );
      console.log(
        `Disbursed fixture: ${closeWithX ? "close" : "stop waiting"} remains available; no cancellation transaction, original payment retained.`,
      );
    } finally {
      release();
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${folder}/proof.json`,
    JSON.stringify(
      {
        treasury,
        id,
        majority: "2/3",
        cancellationReceipt,
        bankTransfersCreated: 0,
        balanceUnchanged: true,
        disbursedStopScenarios: 2,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
