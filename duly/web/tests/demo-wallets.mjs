// Explicit live testnet operations: three new demo wallets, then one dues payment.
import assert from "node:assert/strict";
import { mkdir, chmod, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { read, TOKEN, addr } from "../server/runtime.mjs";

if (!process.argv.includes("--live"))
  throw new Error("Use --live to authorize the isolated Stellar testnet demo.");
const base = process.env.DULY_URL ?? "http://localhost:5182";
await mkdir("test-results/demo-wallets", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [],
  bankActions = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (request) => {
  if (request.url().endsWith("/api/bank"))
    bankActions.push(request.postDataJSON()?.action);
});
const idle = async () => {
  await page
    .locator(".progress-bar")
    .waitFor({ state: "hidden", timeout: 300000 });
  assert.equal(
    await page.locator(".error-box,.v3-modal-error").count(),
    0,
    (await page.locator(".technical,.v3-modal-error").allTextContents()).join(
      "\n",
    ),
  );
};
const balances = (owners) =>
  Promise.all(owners.map((owner) => read(TOKEN, "balance", [addr(owner)])));
const openAccount = async (lang) => {
  await page
    .getByRole("button", {
      name: lang === "tr" ? "Hesabım" : "My account",
      exact: true,
    })
    .click();
  await page
    .locator(".v3-wallet-balance strong")
    .filter({ hasText: "USDC" })
    .waitFor();
};
try {
  await page.goto(base);
  await page.locator(".balance-value").waitFor();
  await page.locator(".v3-demo-launch").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Demoyu başlat", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 300000 });
  await idle();
  const treasury = await page.evaluate(
    () => JSON.parse(localStorage.getItem("duly:v3:demo")).treasury,
  );
  const owners = (await read(treasury, "seats")).map((s) => s.owner);
  assert.deepEqual(await balances(owners), [
    200000000n,
    200000000n,
    200000000n,
  ]);
  assert.equal(
    await read(treasury, "balance"),
    0n,
    "Wallet funding is not a dues contribution",
  );
  const fundingHashes = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("duly:tx:") && k.endsWith(":v3:demo-usdc"))
      .map((k) => JSON.parse(localStorage.getItem(k)).result.hash),
  );
  assert.equal(fundingHashes.length, 3);
  console.log(
    "Fresh demo: all three wallets have 20 test USDC; the treasury remains empty.",
  );
  await openAccount("tr");
  assert.equal(
    await page.locator(".v3-wallet-balance strong").innerText(),
    "20 USDC",
  );
  assert.deepEqual(
    await page.locator(".v3-demo-wallets li strong").allTextContents(),
    ["20 USDC", "20 USDC", "20 USDC"],
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Test USDC yükle", exact: true })
    .click();
  await idle();
  assert.deepEqual(
    await balances(owners),
    [200000000n, 200000000n, 200000000n],
    "Retry cannot double-fund wallets",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kapat", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Aidat öde", exact: true })
    .click();
  await page.getByLabel("Tutar (USDC)", { exact: true }).fill("5");
  await page.locator("main form button[type=submit]").click();
  await idle();
  await openAccount("tr");
  assert.equal(
    await page.locator(".v3-wallet-balance strong").innerText(),
    "15 USDC",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Test USDC yükle", exact: true })
    .click();
  await idle();
  assert.deepEqual(
    await balances(owners),
    [150000000n, 200000000n, 200000000n],
    "Spent demo funds are not silently replenished",
  );
  await page.reload();
  await page.locator(".balance-value").waitFor();
  for (const lang of ["tr", "en"]) {
    await page
      .getByRole("button", { name: lang.toUpperCase(), exact: true })
      .click();
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        await openAccount(lang);
        assert.equal(
          await page.locator(".v3-wallet-balance strong").innerText(),
          "15 USDC",
        );
        assert.deepEqual(
          await page.locator(".v3-demo-wallets li strong").allTextContents(),
          ["15 USDC", "20 USDC", "20 USDC"],
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        const audit = await new AxeBuilder({ page })
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
        await page.screenshot({
          path: `test-results/demo-wallets/${lang}-${width}-${theme}.png`,
        });
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: lang === "tr" ? "Kapat" : "Close",
            exact: true,
          })
          .click();
      }
    }
  }
  assert.equal(
    bankActions.length,
    0,
    "Demo preparation and USDC dues never open a bank transfer",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "test-results/demo-wallets/proof.json",
    JSON.stringify(
      {
        url: base,
        treasury,
        owners,
        fundingHashes,
        balancesUsdc: ["15", "20", "20"],
        contributedUsdc: "5",
        bankTransfersOpened: 0,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Funding replay, balance after 5-USDC dues, reload persistence and 8 TR/EN/theme/viewport account-dialog accessibility scenarios passed.",
  );
} finally {
  await context.storageState({ path: "test-results/demo-wallets/state.json" });
  await chmod("test-results/demo-wallets/state.json", 0o600);
  await browser.close();
}
