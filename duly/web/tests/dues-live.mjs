import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, chmod, writeFile } from "node:fs/promises";
const base = process.env.DULY_URL ?? "http://localhost:5174";
const resume = process.argv.includes("--resume");
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ...(resume ? { storageState: "test-results/dues-state.json" } : {}),
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (r) => {
  if (r.url().includes("/api/") && !r.ok())
    console.log(
      "API error:",
      r.status(),
      (await r.json().catch(() => ({}))).error,
    );
});
const idle = async () => {
  await page.waitForFunction(
    () => !document.querySelector(".progress-bar"),
    {},
    { timeout: 300000 },
  );
  assert.equal(
    await page.locator(".error-box").count(),
    0,
    (await page.locator(".technical,.v3-modal-error").allTextContents()).join(
      "\n",
    ),
  );
};
const nav = async () =>
  page
    .locator("nav")
    .getByRole("button", { name: "Aidat öde", exact: true })
    .click();
const api = async (body) => {
  const r = await context.request.post(base + "/api/dues", { data: body });
  const data = await r.json();
  assert(r.ok(), data.error);
  return data;
};
try {
  await page.goto(base);
  await page.locator(".balance-value").waitFor();
  if (!(await page.locator(".v3-demo-bar").isVisible())) {
    await page
      .getByRole("button", { name: "Demoyu başlat", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Demoyu başlat", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .waitFor({ state: "hidden", timeout: 300000 });
    await idle();
  }
  const treasury = await page.evaluate(
    () => JSON.parse(localStorage.getItem("duly:v3:demo")).treasury,
  );
  await nav();
  await page
    .getByRole("button", { name: "USDC ile katkı", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Test USDC yükle", exact: true })
    .click();
  await idle();
  console.log("Solo demo wallet funded with test USDC; dues are still unpaid.");
  let ledger = await api({ action: "ledger", treasury });
  if (!resume)
    assert.equal(
      ledger.payments.length,
      0,
      "Wallet funding must not count as dues.",
    );
  const form = page.locator("main form");
  for (const [seat, amount] of [
    [1, "5"],
    [2, "1"],
  ]) {
    if (!ledger.payments.some((p) => p.seat === seat)) {
      await page
        .getByLabel("Daire", { exact: true })
        .selectOption(String(seat));
      await page.getByLabel("Tutar (USDC)", { exact: true }).fill(amount);
      await form.locator('button[type="submit"]').click();
      await idle();
      ledger = await api({ action: "ledger", treasury });
    }
    console.log(
      `Apartment ${seat}: direct USDC contribution and frozen TRY credit confirmed.`,
    );
  }
  if (!ledger.payments.some((p) => p.seat === 3)) {
    await page
      .getByRole("button", { name: "TL banka ödemesi", exact: true })
      .click();
    await page.getByLabel("Daire", { exact: true }).selectOption("3");
    await page.getByLabel("Tutar (TL)", { exact: true }).fill("50");
    await form.locator('button[type="submit"]').click();
    await idle();
    ledger = await api({ action: "ledger", treasury });
  }
  assert.equal(ledger.payments.length, 3);
  assert.equal(ledger.payments.find((p) => p.seat === 3).amountTry, "5000");
  const rowsBefore = JSON.stringify(ledger.payments);
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("duly:v3:bank")).find(
      (r) => r.kind === "usdc" && r.phase === "complete",
    ),
  );
  await api({
    action: "record",
    treasury,
    receipt: record.receipt,
    saved: record.saved,
  });
  assert.equal(
    JSON.stringify((await api({ action: "ledger", treasury })).payments),
    rowsBefore,
  );
  console.log(
    "TRY payment indexed at its paid amount. Receipt replay did not double-credit dues.",
  );
  await page.reload();
  await page.locator(".balance-value").waitFor();
  await nav();
  await page
    .getByRole("combobox", { name: "Aidat dönemi", exact: true })
    .selectOption("0");
  await page.locator('tr[data-seat="1"] .v3-dues-paid').waitFor();
  await page.locator('tr[data-seat="2"] .v3-dues-partial').waitFor();
  await page.locator('tr[data-seat="3"] .v3-dues-partial').waitFor();
  await page
    .getByLabel("Yalnızca borcu kalan daireler", { exact: true })
    .check();
  assert.equal(await page.locator('tr[data-seat="1"]').count(), 0);
  assert.equal(await page.locator(".v3-dues-table tbody tr").count(), 2);
  await page
    .getByLabel("Yalnızca borcu kalan daireler", { exact: true })
    .uncheck();
  const independent = await browser.newContext({
    viewport: { width: 360, height: 1000 },
  });
  const other = await independent.newPage();
  await other.goto(`${base}/?building=${treasury}`);
  await other.locator(".balance-value").waitFor();
  await other
    .locator("nav")
    .getByRole("button", { name: "Aidat öde", exact: true })
    .click();
  await other
    .getByRole("combobox", { name: "Aidat dönemi", exact: true })
    .selectOption("0");
  await other.locator('tr[data-seat="1"] .v3-dues-paid').waitFor();
  for (const theme of ["light", "dark"]) {
    await other.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    assert(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const audit = await new AxeBuilder({ page: other })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.equal(
      audit.violations.length,
      0,
      JSON.stringify(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    );
    await other.screenshot({
      path: `test-results/dues-mobile-${theme}.png`,
      fullPage: true,
    });
  }
  await independent.close();
  await page.screenshot({
    path: "test-results/dues-manager.png",
    fullPage: true,
  });
  await writeFile(
    "test-results/dues-proof.json",
    JSON.stringify(
      {
        treasury,
        url: base,
        index: ledger.address,
        payments: ledger.payments,
        replaySafe: true,
        crossBrowser: true,
        period: 0,
      },
      null,
      2,
    ) + "\n",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Dues tracking passed: paid/partial/unpaid filters, reload, separate browser, mobile themes and accessibility.",
  );
} catch (error) {
  console.log(
    (await page.locator(".technical,.v3-modal-error").allTextContents()).join(
      "\n",
    ),
  );
  await page.screenshot({
    path: "test-results/dues-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await context.storageState({ path: "test-results/dues-state.json" });
  await chmod("test-results/dues-state.json", 0o600);
  await browser.close();
}
