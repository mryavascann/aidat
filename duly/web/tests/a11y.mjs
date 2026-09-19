import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { tr as t } from "../src/i18n/tr.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  colorScheme: "light",
});
const page = await context.newPage();
const failures = [];
async function scan(scenario) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  for (const v of result.violations)
    failures.push({
      scenario,
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    });
}
try {
  await page.goto(process.env.DULY_URL ?? "http://127.0.0.1:5173");
  await page.locator(".balance-value").waitFor({ timeout: 60000 });
  await page.locator(".activity-table-row").first().waitFor({ timeout: 60000 });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark")
      await page.getByRole("switch", { name: t.darkMode }).click();
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const key of ["overview", "expenses", "banking", "members"]) {
        await page
          .locator("nav")
          .getByRole("button", { name: t[key], exact: true })
          .click();
        await scan(`${theme}:${width}:${key}`);
      }
      await page.locator(".wallet-button").click();
      await scan(`${theme}:${width}:wallet-dialog`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t.startDemo, exact: true })
        .click();
      await scan(`${theme}:${width}:demo-dialog`);
      await page.getByRole("button", { name: t.close, exact: true }).click();
    }
  }
  console.log(JSON.stringify(failures, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
