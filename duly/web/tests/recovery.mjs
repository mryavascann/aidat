import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Keypair, Networks, WebAuth } from "@stellar/stellar-sdk";
import { en as t } from "../src/i18n/en.ts";
import { ANCHOR, USDC_ISSUER } from "../../scripts/lib/config.mjs";

const deployment = JSON.parse(
  await readFile(new URL("../src/deployment.json", import.meta.url)),
);
const keys = Object.fromEntries(
  ["resident", "admin", "payee"].map((role) => [role, Keypair.random()]),
);
const bank = Keypair.random();
const account = keys.resident.publicKey();
const past = new Date(Date.now() - 3600000).toISOString();
const sample = (id, kind, extra = {}) => ({
  kind,
  account,
  treasury: deployment.treasury,
  amount: kind === "deposit" ? "200" : "2",
  createdAt: past,
  order: {
    id,
    quote: {
      expires_at: past,
      sell_amount: kind === "deposit" ? "200" : "2",
      buy_amount: kind === "deposit" ? "4" : "97",
    },
  },
  ...extra,
});
const expired = sample("fixture-expired-order", "withdraw");
const settled = sample("fixture-settled-order", "deposit", {
  anchorStatus: "completed",
  settlement: {
    status: "completed",
    amount_out: "4",
    stellar_transaction_id: "a".repeat(64),
  },
});
const complete = sample("fixture-completed-order", "deposit", {
  createdAt: new Date(Date.now() - 86400000).toISOString(),
  complete: true,
  receipt: "b".repeat(64),
  settlement: { status: "completed", amount_out: "3" },
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  colorScheme: "light",
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [],
  mutations = [],
  failures = [];
let statusRequests = 0;
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (request) => {
  if (request.postData()?.includes('"method":"sendTransaction"'))
    mutations.push("sendTransaction");
});
await context.addInitScript(
  ({ secrets, treasury, flows, account }) => {
    // Initialize once. Reload must use changes saved by the application itself.
    if (localStorage.getItem("recovery-fixture")) return;
    localStorage.setItem("recovery-fixture", "1");
    localStorage.setItem("duly:language", '"en"');
    localStorage.setItem("duly:demo-active", "true");
    localStorage.setItem(
      "duly:demo",
      JSON.stringify({ secrets, ready: true, treasury, salt: [] }),
    );
    localStorage.setItem(
      `duly:bank-history:${treasury}:${account}`,
      JSON.stringify(flows),
    );
  },
  {
    secrets: Object.fromEntries(
      Object.entries(keys).map(([role, key]) => [role, key.secret()]),
    ),
    treasury: deployment.treasury,
    flows: [expired, settled, complete],
    account,
  },
);
await page.route(`${ANCHOR}/**`, async (route) => {
  const request = route.request(),
    url = new URL(request.url()),
    path = url.pathname;
  const json = (value) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  if (path === "/.well-known/stellar.toml")
    return route.fulfill({
      contentType: "text/plain",
      body: `NETWORK_PASSPHRASE="${Networks.TESTNET}"\nSIGNING_KEY="${bank.publicKey()}"\nWEB_AUTH_ENDPOINT="${ANCHOR}/auth"\nTRANSFER_SERVER="${ANCHOR}/sep6"\nKYC_SERVER="${ANCHOR}/kyc"\nANCHOR_QUOTE_SERVER="${ANCHOR}/sep38"\n[[CURRENCIES]]\ncode="USDC"\nissuer="${USDC_ISSUER}"`,
    });
  if (path === "/health")
    return json({
      environment: "sandbox",
      network_passphrase: Networks.TESTNET,
      rates: { mid_rate: "49", buy_rate: "50", sell_rate: "48" },
      time: new Date().toISOString(),
    });
  if (path === "/sep6/info") return json({});
  if (path === "/auth" && request.method() === "GET")
    return json({
      transaction: WebAuth.buildChallengeTx(
        bank,
        account,
        new URL(ANCHOR).hostname,
        300,
        Networks.TESTNET,
        new URL(ANCHOR).hostname,
      ),
      network_passphrase: Networks.TESTNET,
    });
  if (path === "/auth" && request.method() === "POST")
    return json({ token: "fixture-token" });
  if (path === "/sep6/transaction") {
    statusRequests++;
    return json({
      transaction: { id: url.searchParams.get("id"), status: "expired" },
    });
  }
  mutations.push(path);
  return route.fulfill({
    status: 500,
    contentType: "application/json",
    body: '{"error":"Unexpected mutation in read-only recovery test"}',
  });
});
async function scan(name) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    `${name}: overflow`,
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  failures.push(
    ...result.violations.map((v) => ({
      scenario: name,
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  );
}
try {
  await mkdir("test-results", { recursive: true });
  await page.goto(process.env.DULY_URL ?? "http://127.0.0.1:5173");
  await page.locator(".balance-value").waitFor();
  await page
    .locator(".next-card")
    .getByRole("heading", { name: t.nextResume })
    .waitFor();
  await page
    .locator("nav")
    .getByRole("button", { name: t.banking, exact: true })
    .click();
  assert.equal(await page.locator(".payment-row").count(), 3);
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("switch", { name: t.darkMode }).click();
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await scan(`${theme}:${width}:payment-history`);
      await page.screenshot({
        path: `test-results/history-${theme}-${width}.png`,
        fullPage: true,
      });
      const row = page
        .locator(".payment-row")
        .filter({ hasText: t.payment_expired });
      await row.getByRole("button").click();
      assert.equal(
        await page
          .getByRole("button", { name: t.confirmWithdraw, exact: true })
          .count(),
        0,
      );
      await scan(`${theme}:${width}:expired-order`);
      await page
        .getByRole("button", { name: t.checkPayment, exact: true })
        .click();
      await page.locator(".dialog-progress").waitFor({ state: "hidden" });
      assert.equal(await page.locator(".error-box").count(), 0);
      await page.getByText(t.savedReference, { exact: true }).click();
      await page.getByText("fixture-expired-order", { exact: true }).waitFor();
      await page.screenshot({
        path: `test-results/expired-${theme}-${width}.png`,
      });
      await page.getByRole("button", { name: t.close, exact: true }).click();
      await page
        .locator(".payment-row")
        .filter({ hasText: t.payment_contribute })
        .getByRole("button")
        .click();
      assert.equal(
        await page.locator(".payment-steps [aria-current=step]").innerText(),
        `3\n${t.stageReserve}`,
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t.resume, exact: true })
        .waitFor();
      await scan(`${theme}:${width}:settled-deposit`);
      await page.getByRole("button", { name: t.close, exact: true }).click();
      await page
        .locator(".payment-row")
        .filter({ hasText: t.payment_complete })
        .getByRole("button")
        .click();
      await page
        .getByRole("heading", { name: t.complete, exact: true })
        .waitFor();
      await scan(`${theme}:${width}:completed-receipt`);
      await page.getByRole("button", { name: t.close, exact: true }).click();
    }
  }
  await page.reload();
  await page.locator(".balance-value").waitFor();
  await page
    .locator("nav")
    .getByRole("button", { name: t.banking, exact: true })
    .click();
  assert.equal(await page.locator(".payment-row").count(), 3);
  assert.equal(
    await page.evaluate(
      ({ treasury, account }) =>
        JSON.parse(
          localStorage.getItem(`duly:bank-history:${treasury}:${account}`),
        ).find((f) => f.order.id === "fixture-expired-order").anchorStatus,
      { treasury: deployment.treasury, account },
    ),
    "expired",
  );
  await page
    .locator(".role-switch")
    .getByRole("button", { name: t.admin, exact: true })
    .click();
  await page.getByRole("heading", { name: t.noPayments }).waitFor();
  assert.equal(await page.locator(".payment-row").count(), 0);
  assert.equal(statusRequests, 4);
  assert.deepEqual(mutations, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log(
    "Recovery passed: legacy-compatible history, expiry, authenticated status check, settled contribution, receipt, reload, account isolation, 16 light/dark accessibility scenarios; no payment submitted.",
  );
} finally {
  await browser.close();
}
