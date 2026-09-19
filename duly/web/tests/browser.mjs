import { tr as t } from "../src/i18n/tr.ts";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, chmod } from "node:fs/promises";

await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error")
    console.log("Browser console:", msg.text().slice(0, 250));
});
page.setDefaultTimeout(60000);
try {
  await page.goto(process.env.DULY_URL ?? "http://127.0.0.1:5173");
  await page.locator(".balance-value").waitFor();
  await page.locator(".activity-table-row").first().waitFor();
  console.log(
    "Public treasury:",
    await page.locator(".balance-value").innerText(),
  );
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your community, in balance." })
    .waitFor();
  await page.screenshot({
    path: "test-results/desktop-en.png",
    fullPage: true,
  });
  for (const name of ["Expenses", "Bank payments", "Members", "Overview"]) {
    await page
      .locator("nav")
      .getByRole("button", { name, exact: true })
      .click();
    await page.locator("main h1").waitFor();
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    "Mobile horizontal overflow",
  );
  await page.getByRole("button", { name: "TR", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("button", { name: t.startDemo, exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: "test-results/demo-dialog.png" });
  if (process.env.DULY_LIVE_E2E === "1" || process.argv.includes("--live")) {
    page.setDefaultTimeout(240000);
    console.log("Creating independent browser demo on testnet…");
    await page.getByRole("button", { name: t.createDemo, exact: true }).click();
    await page.locator(".demo-toolbar").waitFor();
    await page.locator(".balance-value").waitFor();
    await page
      .locator(".heading-actions")
      .getByRole("button", { name: t.contribute, exact: true })
      .click();
    await page.getByRole("button", { name: t.quote, exact: true }).click();
    await page.locator(".transfer-instructions").waitFor();
    console.log("Anchor order saved; reloading to test recovery.");
    await context.storageState({ path: "test-results/browser-state.json" });
    await page.reload();
    await page.locator(".balance-value").waitFor();
    await page
      .locator(".heading-actions")
      .getByRole("button", { name: t.contribute, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: t.simulate,
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", { name: t.complete, exact: true })
      .waitFor();
    await page.getByRole("button", { name: t.close, exact: true }).click();
    console.log(
      "Bank contribution vaulted:",
      await page.locator(".balance-value").innerText(),
    );
    await page
      .locator(".heading-actions")
      .getByRole("button", { name: t.newExpense, exact: true })
      .click();
    await page.getByLabel("Bu gider ne için?").fill("Shared elevator repair");
    await page
      .getByRole("button", { name: t.submitExpense, exact: true })
      .click();
    await page.locator(".expense-row").first().waitFor();
    await page.getByRole("button", { name: t.admin, exact: true }).click();
    await page.getByRole("button", { name: t.approve, exact: true }).click();
    await page.getByRole("button", { name: t.execute, exact: true }).click();
    await page.locator(".status.executed").waitFor();
    console.log(
      "Two-member approval and automatic vault withdrawal succeeded.",
    );
    await page.getByRole("button", { name: t.payee, exact: true }).click();
    await page
      .locator("nav")
      .getByRole("button", { name: t.banking, exact: true })
      .click();
    await page.getByRole("button", { name: t.withdraw, exact: true }).click();
    await page
      .getByRole("button", { name: t.withdrawalQuote, exact: true })
      .click();
    await page
      .getByRole("button", { name: t.confirmWithdraw, exact: true })
      .click();
    await page
      .getByRole("heading", { name: t.complete, exact: true })
      .waitFor();
    await page.screenshot({ path: "test-results/withdrawal.png" });
    await page.getByRole("button", { name: t.close, exact: true }).click();
    console.log("Bank withdrawal completed.");
    await context.storageState({ path: "test-results/browser-state.json" });
    await page.getByRole("button", { name: t.admin, exact: true }).click();
    await page
      .locator("nav")
      .getByRole("button", { name: t.members, exact: true })
      .click();
    await page.getByRole("button", { name: t.invite, exact: true }).click();
    await page.locator(".invite-dialog img").waitFor();
    const invitation = await page.locator(".invite-dialog input").inputValue();
    await page.goto(invitation);
    await page.locator(".balance-value").waitFor();
    await page.getByRole("button", { name: t.join, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t.resumeDemo, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: t.resumeDemo, exact: true })
      .click();
    await page.getByRole("button", { name: t.payee, exact: true }).click();
    await page.getByRole("button", { name: t.join, exact: true }).click();
    await page
      .locator(".invite-banner button")
      .filter({ hasText: "Bağlı" })
      .waitFor();
    console.log("Single-use invitation joined with a third testnet account.");
    await context.storageState({ path: "test-results/browser-state.json" });
    await page
      .locator("nav")
      .getByRole("button", { name: t.overview, exact: true })
      .click();
    await page.screenshot({
      path: "test-results/live-demo.png",
      fullPage: true,
    });
    const publicState = await page.evaluate(() => {
      const demo = JSON.parse(localStorage.getItem("duly:demo"));
      const flows = Object.keys(localStorage)
        .filter((k) => k.startsWith("duly:bank:"))
        .map((k) => JSON.parse(localStorage.getItem(k)));
      return {
        treasury: demo.treasury,
        flows: flows.map((f) => ({
          kind: f.kind,
          account: f.account,
          anchorId: f.order.id,
          complete: f.complete,
          amountIn: f.settlement?.amount_in,
          amountOut: f.settlement?.amount_out,
          bankReference: f.settlement?.external_transaction_id,
          receipt: f.receipt,
        })),
      };
    });
    console.log("Live browser evidence:", JSON.stringify(publicState));
  }
  assert.deepEqual(errors, [], "Uncaught browser exceptions");
  console.log(
    "Browser checks passed (desktop, mobile, both languages, navigation, dialogs).",
  );
} finally {
  if (process.env.DULY_LIVE_E2E === "1" || process.argv.includes("--live")) {
    await context.storageState({ path: "test-results/browser-state.json" });
    await chmod("test-results/browser-state.json", 0o600);
  }
  await browser.close();
}
