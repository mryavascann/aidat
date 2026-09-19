import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, chmod, readFile, writeFile } from "node:fs/promises";

await mkdir("test-results", { recursive: true });
const live = process.argv.includes("--live"),
  resume = process.argv.includes("--resume");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ...(resume ? { storageState: "test-results/building-state.json" } : {}),
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (r) => {
  if (r.url().includes("/api/") && !r.ok()) {
    const b = await r.json().catch(() => ({}));
    console.log("API failed:", r.status(), b.error ?? b.success);
  }
});
const url = process.env.DULY_URL ?? "http://127.0.0.1:5174";
const nav = async (name) =>
  page.locator("nav").getByRole("button", { name, exact: true }).click();
const idle = async () => {
  await page.waitForFunction(
    () => !document.querySelector(".progress-bar"),
    {},
    { timeout: 240000 },
  );
  const errors = await page.locator(".error-box .technical").allTextContents();
  assert.equal(errors.length, 0, errors.join("\n"));
};
try {
  await page.goto(url);
  await page.locator(".balance-value").waitFor();
  console.log("Verified building visible.");
  if (!live) {
    for (const lang of ["TR", "EN"]) {
      await page.getByRole("button", { name: lang, exact: true }).click();
      for (const width of [1440, 360]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ["light", "dark"]) {
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
            localStorage.setItem("duly:theme", JSON.stringify(theme));
          }, theme);
          const names =
            lang === "TR"
              ? ["Genel bakış", "Giderler", "Aidat öde", "Daireler & kararlar"]
              : ["Overview", "Expenses", "Pay dues", "Apartments & decisions"];
          for (const name of names) {
            await nav(name);
            await page.waitForTimeout(100);
            assert(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              `${lang} ${width} ${name} overflow`,
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
                  nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                  })),
                })),
              ),
            );
            await page.screenshot({
              path: `test-results/v3-${lang}-${width}-${theme}-${names.indexOf(name)}.png`,
              fullPage: true,
            });
          }
        }
      }
    }
    console.log("32 language/theme/viewport/page scenarios passed.");
  } else {
    await page.getByRole("button", { name: "TR", exact: true }).click();
    if (!(await page.locator(".v3-demo-bar").isVisible())) {
      await page
        .getByRole("button", { name: "Demoyu başlat", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Demoyu başlat", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          !document.querySelector("dialog[open]") ||
          document.querySelector(".v3-modal-error"),
        {},
        { timeout: 240000 },
      );
      await idle();
      await idle();
    }
    console.log("Solo demo ready.");
    await nav("Aidat öde");
    const tryMethod = page.getByRole("button", {
      name: "TL banka ödemesi",
      exact: true,
    });
    if (await tryMethod.isEnabled()) await tryMethod.click();
    const completed = await page
      .locator(".v3-history")
      .filter({ hasText: "Tamamlandı" })
      .count();
    if (!completed) {
      await page
        .locator("main form")
        .getByRole("button", { name: /TL ile öde|Kaldığı yerden sürdür/ })
        .click();
      await idle();
    }
    assert(
      (await page
        .locator(".v3-history")
        .filter({ hasText: "Tamamlandı" })
        .count()) > 0,
      "Bank deposit not completed",
    );
    console.log("TRY deposit and contribution confirmed.");
    await nav("Giderler");
    if (!(await page.locator(".v3-expense").count())) {
      await page
        .getByRole("button", { name: "Gider oluştur", exact: true })
        .click();
      await page
        .getByLabel("Açıklama", { exact: true })
        .fill("Temizlik · bağımsız V3 testi");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "İmzala ve gönder", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await idle();
    }
    const expense = page
      .locator(".v3-expense")
      .filter({ hasText: "Temizlik · bağımsız V3 testi" })
      .first();
    await page.waitForFunction(
      () =>
        document.querySelector(".error-box") ||
        Array.from(document.querySelectorAll(".v3-expense")).some(
          (e) =>
            e.textContent.includes("Temizlik · bağımsız V3 testi") &&
            e.textContent.includes("Banka teyidi alındı"),
        ),
      {},
      { timeout: 300000 },
    );
    await idle();
    await expense.locator(".v3-bank-receipt").waitFor({ timeout: 60000 });
    console.log(
      "New-IBAN expense settled after the accelerated objection window.",
    );
    const publicState = await page.evaluate(() => {
      const demo = JSON.parse(localStorage.getItem("duly:v3:demo"));
      const bank = JSON.parse(localStorage.getItem("duly:v3:bank") ?? "[]");
      return {
        treasury: demo.treasury,
        receipts: bank.map(
          ({ kind, phase, amountTry, amountUsdc, receipt, bankReference }) => ({
            kind,
            phase,
            amountTry,
            amountUsdc,
            receipt,
            bankReference,
          }),
        ),
      };
    });
    await writeFile(
      "test-results/building-proof.json",
      JSON.stringify(publicState, null, 2),
    );
    await page.screenshot({ path: "test-results/v3-live.png", fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log("Browser checks passed.");
} catch (error) {
  console.log(
    "Visible errors:",
    (await page.locator(".technical,.v3-modal-error").allTextContents())
      .join("\n")
      .slice(0, 2500),
  );
  await page.screenshot({
    path: "test-results/v3-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  if (live) {
    await context.storageState({ path: "test-results/building-state.json" });
    await chmod("test-results/building-state.json", 0o600);
  }
  await browser.close();
}
