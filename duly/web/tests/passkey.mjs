// A virtual CTAP2 authenticator exercises real WebAuthn and real testnet
// authorization. It does not claim to test the user's physical biometrics.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile, readFile, chmod } from "node:fs/promises";
import { readAs } from "../../scripts/lib/soroban.mjs";
const deployment = JSON.parse(
  await readFile("src/building-deployment.json", "utf8"),
);
const seats = await readAs(deployment.treasury, "seats");
await mkdir("test-results", { recursive: true });
const resume = process.argv.includes("--resume");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ...(resume ? { storageState: "test-results/passkey-state.json" } : {}),
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
const session = await context.newCDPSession(page);
await session.send("WebAuthn.enable");
const { authenticatorId } = await session.send(
  "WebAuthn.addVirtualAuthenticator",
  {
    options: {
      protocol: "ctap2",
      ctap2Version: "ctap2_1",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  },
);
if (resume)
  for (const credential of JSON.parse(
    await readFile("test-results/passkey-credentials.json", "utf8"),
  ))
    await session.send("WebAuthn.addCredential", {
      authenticatorId,
      credential,
    });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (r) => {
  if (r.url().includes("/api/") && !r.ok())
    console.log(
      "API failed:",
      r.status(),
      (await r.json().catch(() => ({}))).error,
    );
});
const idle = async () => {
  await page.waitForFunction(
    () => !document.querySelector(".progress-bar"),
    {},
    { timeout: 240000 },
  );
  assert.equal(
    await page.locator(".error-box").count(),
    0,
    (await page.locator(".technical").allTextContents()).join("\n"),
  );
};
try {
  await page.goto(process.env.DULY_URL ?? "http://localhost:5174");
  await page.locator(".balance-value").waitFor();
  if (resume)
    await page
      .getByRole("button", { name: "Hesabım", exact: true })
      .waitFor({ timeout: 60000 });
  if (
    !(await page
      .getByRole("button", { name: "Hesabım", exact: true })
      .isVisible())
  ) {
    await page
      .getByRole("button", { name: "Hesap aç / giriş yap", exact: true })
      .click();
    await page.getByLabel("Görünen adınız", { exact: true }).fill("Passkey QA");
    await page.getByRole("button", { name: "Devam et", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Passkey ile hesap oluştur", exact: true })
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
  await page.getByRole("button", { name: "Hesabım", exact: true }).click();
  const address = await page
    .getByRole("dialog")
    .locator(".v3-account>.mono")
    .innerText();
  assert.match(address, /^C[A-Z2-7]{55}$/);
  console.log("Real testnet passkey account:", address);
  const savedBuilding = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("duly:v3:building") ?? "null"),
  );
  if (!savedBuilding || savedBuilding === deployment.treasury) {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Yeni bina oluştur", exact: true })
      .click();
    await page
      .getByLabel("Bina adı", { exact: true })
      .fill("Passkey Apartmanı");
    await page
      .getByLabel("Yönetici IBAN’ı", { exact: true })
      .fill("TR330006100519786457841326");
    await page
      .getByLabel("Daire sahiplerinin adresleri", { exact: true })
      .fill([address, seats[1].owner].join("\n"));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "İmzala ve gönder", exact: true })
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
  } else
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Kapat", exact: true })
      .click();
  const id = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("duly:v3:building")),
  );
  const config = await readAs(id, "config");
  assert.equal(config.manager, address);
  assert.equal(config.seat_count, 2);
  assert.equal(config.demo, false);
  console.log("Passkey-authorized normal building:", id);
  await page
    .locator("nav")
    .getByRole("button", { name: "Aidat öde", exact: true })
    .click();
  if (
    !(await page
      .locator(".v3-history")
      .filter({ hasText: "Tamamlandı" })
      .count())
  ) {
    const tryMethod = page.getByRole("button", {
      name: "TL banka ödemesi",
      exact: true,
    });
    if (await tryMethod.isEnabled()) await tryMethod.click();
    const input = page.getByLabel("Tutar (TL)", { exact: true });
    if (await input.isEnabled()) await input.fill("50");
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
  );
  assert(
    (await readAs(id, "contribution", [
      (await import("@duly/stellar-sdk")).nativeToScVal(1, { type: "u32" }),
    ])) > 0n,
  );
  console.log(
    "Bank → smart account → treasury contribution authorized by WebAuthn.",
  );
  const duesResponse = await context.request.post(
    `${process.env.DULY_URL ?? "http://localhost:5174"}/api/dues`,
    { data: { action: "ledger", treasury: id } },
  );
  assert(duesResponse.ok());
  const duesLedger = await duesResponse.json();
  assert(
    duesLedger.payments.some(
      (p) => p.seat === 1 && p.amountTry === "5000" && p.method === "TRY",
    ),
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Daireler & kararlar", exact: true })
    .click();
  if (!(await page.locator(".v3-motion").count())) {
    await page.getByRole("button", { name: "Karar öner", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "İmzala ve gönder", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document.querySelector("dialog[open]") ||
        document.querySelector(".v3-modal-error"),
      {},
      { timeout: 240000 },
    );
    await idle();
  }
  const motion = page.locator(".v3-motion").first();
  for (const support of [true, false, true]) {
    const button = motion.getByRole("button", {
      name: support ? "Onay" : "Reddet",
      exact: true,
    });
    if (await button.isEnabled()) {
      await button.click();
      await idle();
    }
  }
  const votes = await readAs(id, "motion_tally", [
    (await import("@duly/stellar-sdk")).nativeToScVal(1, { type: "u32" }),
  ]);
  assert.deepEqual(votes, [1, 0]);
  console.log("Passkey proposal and vote changes count exactly one apartment.");
  await writeFile(
    "test-results/passkey-proof.json",
    JSON.stringify(
      {
        account: address,
        treasury: id,
        virtualAuthenticator: true,
        normalTimings: true,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
} catch (error) {
  console.log(
    "Visible error:",
    (await page.locator(".technical,.v3-modal-error").allTextContents())
      .join("\n")
      .slice(0, 3000),
  );
  await page.screenshot({
    path: "test-results/passkey-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await context.storageState({
    path: "test-results/passkey-state.json",
    indexedDB: true,
  });
  await chmod("test-results/passkey-state.json", 0o600);
  const { credentials } = await session.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  await writeFile(
    "test-results/passkey-credentials.json",
    JSON.stringify(credentials),
    { mode: 0o600 },
  );
  await browser.close();
}
