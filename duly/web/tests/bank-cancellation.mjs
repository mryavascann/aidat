// Controlled bank responses exercise cancellation races without moving funds.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Keypair } from "@duly/stellar-sdk";
import { mkdir } from "node:fs/promises";
import deployment from "../src/building-deployment.json" with { type: "json" };

const base = process.env.DULY_URL ?? "http://localhost:5182";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const key = Keypair.random();
const fixture = {
  key: "cancellation-fixture",
  kind: "deposit",
  phase: "processing",
  bankStatus: "pending_anchor",
  treasury: deployment.treasury,
  account: key.publicKey(),
  seat: 1,
  amountTry: "200",
  amountUsdc: "4.1",
  saved: "fixture-sealed-route",
  anchorId: "fixture-order",
};
await mkdir("test-results/bank-cancellation", { recursive: true });
await context.addInitScript(
  ({ fixture, secret }) => {
    if (localStorage.getItem("duly:test-cancellation")) return;
    localStorage.setItem("duly:test-cancellation", "true");
    localStorage.setItem("duly:language", JSON.stringify("en"));
    localStorage.setItem("duly:v3:demo-active", "true");
    localStorage.setItem(
      "duly:v3:demo",
      JSON.stringify({
        ready: true,
        treasury: fixture.treasury,
        secrets: [secret],
      }),
    );
    localStorage.setItem("duly:v3:bank", JSON.stringify([fixture]));
  },
  { fixture, secret: key.secret() },
);
const requests = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let releaseBank;
const waitingBank = new Promise((resolve) => {
  releaseBank = resolve;
});
let firstResume = true;
await context.route("**/api/bank", async (route) => {
  const request = route.request().postDataJSON();
  requests.push(request);
  assert(
    ["resume", "status"].includes(request.action),
    "Cancellation must not create a new bank payment",
  );
  if (request.action === "status") {
    await route.fulfill({
      json: {
        bankStatus: "completed",
        statusCheckedAt: new Date().toISOString(),
      },
    });
  } else if (firstResume) {
    firstResume = false;
    await waitingBank;
    await route.fulfill({
      json: {
        phase: "contribute",
        saved: "late-bank-response",
        receipt: "a".repeat(64),
        amountUsdc: "4.1",
      },
    });
  } else {
    await route.fulfill({
      json: { phase: "processing", bankStatus: "pending_anchor" },
    });
  }
});
await context.route("**/soroban-testnet.stellar.org/**", async (route) => {
  assert.notEqual(
    route.request().postDataJSON()?.method,
    "sendTransaction",
    "No transaction may be sent in this fixture test",
  );
  await route.continue();
});
const navigate = async () => {
  await page.locator(".balance-value").waitFor({ timeout: 60000 });
  const name =
    (await page
      .getByRole("button", { name: "EN", exact: true })
      .getAttribute("aria-pressed")) === "true"
      ? "Pay dues"
      : "Aidat öde";
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
};
const current = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("duly:v3:bank"))[0]);
const idle = async () => {
  await page
    .locator(".progress-bar")
    .waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(await page.locator(".error-box").count(), 0);
};
try {
  await page.goto(base);
  await navigate();
  const form = page.locator("main form");
  assert(
    await form
      .getByRole("button", { name: "Contribute USDC", exact: true })
      .isDisabled(),
  );
  await form
    .getByRole("button", { name: "Resume payment", exact: true })
    .click();
  await page.waitForFunction(() => !!document.querySelector(".progress-bar"));
  await form.getByRole("button", { name: "Cancel dues", exact: true }).click();
  assert((await current()).stoppedAt);
  assert(
    await form
      .getByRole("button", { name: "Contribute USDC", exact: true })
      .first()
      .isEnabled(),
  );
  releaseBank();
  await idle();
  const after = await current();
  assert(after.stoppedAt);
  assert.equal(after.phase, "contribute");
  assert.equal(after.saved, "late-bank-response");
  assert.equal(after.receipt, "a".repeat(64));
  assert.equal(
    requests.length,
    1,
    "Late response must not trigger another bank operation",
  );
  assert(
    await page.getByText("Dues workflow stopped", { exact: true }).isVisible(),
  );
  await page.reload();
  await navigate();
  assert((await current()).stoppedAt, "Cancellation survives reload");
  await page
    .getByRole("button", { name: "Check bank status", exact: true })
    .click();
  await idle();
  assert.deepEqual(requests.at(-1), {
    action: "status",
    saved: "late-bank-response",
  });
  assert(
    (await current()).stoppedAt,
    "A status read cannot resume a cancelled workflow",
  );

  for (const lang of ["TR", "EN"])
    for (const width of [1440, 360])
      for (const theme of ["light", "dark"]) {
        await page.getByRole("button", { name: lang, exact: true }).click();
        await page.setViewportSize({ width, height: 1000 });
        const toggle = page.getByRole("switch");
        if (
          (await toggle.getAttribute("aria-checked")) !==
          String(theme === "dark")
        )
          await toggle.click();
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
            targets: v.nodes.map((n) => n.target),
          })),
          [],
        );
        await page.screenshot({
          path: `test-results/bank-cancellation/${lang}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
  // Resume still uses the same saved route. Return processing immediately,
  // proving a pending bank no longer runs a 35-iteration foreground loop.
  await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem("duly:v3:bank"));
    records[0].phase = "processing";
    localStorage.setItem("duly:v3:bank", JSON.stringify(records));
  });
  await page.reload();
  await navigate();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume these dues", exact: true })
    .click();
  await idle();
  assert(!(await current()).stoppedAt);
  assert.equal((await current()).phase, "processing");
  assert.deepEqual(requests.at(-1), {
    saved: "late-bank-response",
    action: "resume",
  });
  assert.equal(requests.length, 3);
  assert(
    await page
      .locator("main form")
      .getByRole("button", { name: "TRY bank payment", exact: true })
      .isDisabled(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Cancellation during an in-flight bank response, persistence, read-only status, same-reference resume and bounded waiting passed; 8 TR/EN/theme/viewport accessibility scenarios passed. No funds moved.",
  );
} finally {
  releaseBank();
  await browser.close();
}
