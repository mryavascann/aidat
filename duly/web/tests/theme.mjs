import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { tr as t } from "../src/i18n/tr.ts";

const url = process.env.DULY_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await mkdir("test-results", { recursive: true });
  // The page must choose its theme before the application bundle executes.
  for (const [system, saved, expected] of [
    ["dark", null, "dark"],
    ["light", null, "light"],
    ["dark", "light", "light"],
    ["light", "dark", "dark"],
  ]) {
    const context = await browser.newContext({ colorScheme: system });
    if (saved)
      await context.addInitScript(
        (theme) => localStorage.setItem("duly:theme", JSON.stringify(theme)),
        saved,
      );
    const page = await context.newPage();
    await page.route("**/assets/*.js", (route) => route.abort());
    await page.goto(url);
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      expected,
    );
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
      expected,
    );
    assert.equal(
      await page.locator(".app-shell").count(),
      0,
      "Initial theme must not depend on React loading",
    );
    await context.close();
  }

  const context = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator(".balance-value").waitFor();
  const toggle = page.getByRole("switch", { name: t.darkMode });
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-checked"), "false");
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem("duly:theme"))),
    "light",
  );
  await page.reload();
  await page.locator(".balance-value").waitFor();
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    "light",
    "Saved light overrides the dark system preference",
  );
  await toggle.focus();
  await page.keyboard.press("Space");
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    "dark",
    "An explicit choice overrides subsequent system changes",
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("switch", { name: "Dark mode", exact: true }).waitFor();
  await page.locator(".activity-table-row").first().waitFor();
  await page.screenshot({
    path: "test-results/dark-desktop.png",
    fullPage: true,
  });
  for (const width of [360, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `${width}px horizontal overflow`,
    );
    const button = await page.getByRole("switch").boundingBox();
    assert(button.width >= 44 && button.height >= 44);
    await page.screenshot({
      path: `test-results/dark-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator(".wallet-button").click();
  await page
    .getByRole("button", { name: "Choose a wallet", exact: true })
    .click();
  for (const wallet of ["Freighter", "xBull", "Albedo"])
    await page.getByText(wallet, { exact: true }).waitFor();
  assert.notEqual(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--swk-background"),
    ),
    "#fcfcfcff",
  );
  await page.screenshot({ path: "test-results/dark-wallets.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Theme verified: before-app initialization, system preference changes, saved override, reload, keyboard toggle, TR/EN, mobile/tablet layout and dark wallet chooser.",
  );
} finally {
  await browser.close();
}
