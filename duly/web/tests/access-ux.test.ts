import test from "node:test";
import assert from "node:assert/strict";
import { parseBuildingLink, buildingLink } from "../src/lib/building-access.ts";
import {
  displayName,
  expenseCeiling,
  isFreshRate,
  managerIbanKey,
} from "../src/lib/expense-form.ts";

const building = "CBIGWOYBTFHV32OZWTZSYKP2TLDPHJIDJJSG5XAGG22K6VRSSP2MLIMM";

test("shared QR links preserve the building while exposing no account or payment data", () => {
  const url = buildingLink(
    "https://duly.example/old?secret=ignored#private",
    building,
  );
  assert.equal(url, `https://duly.example/?building=${building}`);
  assert.equal(parseBuildingLink(`  ${url}  `), building);
  assert.equal(parseBuildingLink(building), building);
  assert.equal(
    parseBuildingLink(`https://a-different-host.example/?building=${building}`),
    building,
  );
});

test("QR input rejects malformed, ambiguous and executable links", () => {
  for (const link of [
    "",
    "not a link",
    "https://example.com",
    `javascript:alert(1)?building=${building}`,
    `https://user:password@example.com/?building=${building}`,
    `https://example.com/?building=${building}&building=${building}`,
    `https://example.com/?building=${building.slice(0, -1)}A`,
    "https://example.com/?building=GABC",
  ])
    assert.throws(() => parseBuildingLink(link), link);
});

test("automatic USDC ceilings track TRY amounts, include headroom and round upward", () => {
  assert.equal(expenseCeiling("100", 50), "2.20");
  assert.equal(expenseCeiling("1000", 50), "22.00");
  assert.equal(expenseCeiling("100", 48.540115), "2.27");
  assert.equal(expenseCeiling("100.01", 50), "2.21");
  assert.equal(expenseCeiling("0.01", 50), "0.01");
  assert.equal(expenseCeiling("99999999.99", 50), "2200000.00");
});

test("invalid amounts and rates cannot produce a spendable ceiling", () => {
  for (const amount of ["", "0", "-1", "1.001", "NaN", "1e3"])
    assert.throws(() => expenseCeiling(amount, 50));
  for (const rate of [0, -1, NaN, Infinity, 1e-10])
    assert.throws(() => expenseCeiling("100", rate));
  assert.equal(isFreshRate(1000, 60_999), true);
  assert.equal(isFreshRate(1000, 61_000), false);
  assert.equal(isFreshRate(0, 100), false);
  assert.equal(isFreshRate(1000, 999), false);
});

test("manager bank preferences cannot carry into another building or manager", () => {
  assert.notEqual(
    managerIbanKey(building, "manager-a"),
    managerIbanKey(building, "manager-b"),
  );
  assert.notEqual(
    managerIbanKey(building, "manager-a"),
    managerIbanKey("another", "manager-a"),
  );
});

test("passkey creation requires a real display name before prompting", () => {
  for (const name of ["", "  ", " A ", "a".repeat(41)])
    assert.throws(() => displayName(name));
  assert.equal(displayName("  Deniz   Yılmaz  "), "Deniz Yılmaz");
  assert.equal(displayName("Samet"), "Samet");
});

test("the account adapter rejects missing names before accessing browser credentials", async () => {
  const { createAccount } = await import("../accounts/index.mjs");
  await assert.rejects(createAccount("  "), /display name/);
  await assert.rejects(createAccount(undefined), /display name/);
});
