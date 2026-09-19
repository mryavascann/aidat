import test from "node:test";
import assert from "node:assert/strict";
import { actionErrorMessage } from "../src/lib/action-errors.ts";
import { buildingCopy, buildingMessageKey } from "../src/i18n/building.ts";
import {
  availableExpenseFunds,
  DEMO_MANAGER_IBAN,
} from "../src/lib/expense-form.ts";
import { normalizeIban } from "../src/lib/iban.ts";
import { expensePaymentBlock } from "../server/bank.mjs";
import {
  authenticationOptions,
  registrationSelection,
} from "../accounts/passkey-options.mjs";

test("contract diagnostics become useful bilingual messages without exposing the log", () => {
  const diagnostic =
    "HostError: Error(Contract, #21) Event log: [Diagnostic Event] very long internal data";
  assert.equal(
    actionErrorMessage(diagnostic, "tr"),
    "Kasada yeterli bakiye yok.",
  );
  assert.equal(
    actionErrorMessage(diagnostic, "en"),
    "There is not enough money in the treasury.",
  );
  assert.match(
    actionErrorMessage("Error(Contract, #11)", "en"),
    /objection window/,
  );
  assert.match(actionErrorMessage("Error(Contract, #19)", "en"), /expired/);
  assert.match(
    actionErrorMessage("NotAllowedError: cancelled", "en"),
    /Device verification/,
  );
  assert.equal(
    actionErrorMessage("Unexpected secret internal details", "en"),
    buildingCopy("en")("errorGeneric"),
  );
});

test("saved notifications and validation errors use the currently selected language", () => {
  for (const key of [
    "success",
    "copied",
    "processing",
    "invalidIban",
    "nameRequired",
    "rateUnavailable",
    "cameraUnavailable",
  ] as const) {
    assert.equal(buildingMessageKey(buildingCopy("tr")(key)), key);
    assert.equal(
      actionErrorMessage(buildingCopy("tr")(key), "en"),
      buildingCopy("en")(key),
    );
    assert.equal(actionErrorMessage(key, "tr"), buildingCopy("tr")(key));
  }
  assert.equal(normalizeIban(DEMO_MANAGER_IBAN), DEMO_MANAGER_IBAN);
});

test("new expenses reserve pending ceilings but never double-count settled money", () => {
  const expenses = [
    { status: "Pending", max_usdc: 200n },
    { status: "Settled", max_usdc: 900n },
    { status: "Cancelled", max_usdc: 900n },
    { status: "Disbursed", max_usdc: 900n },
  ];
  assert.equal(availableExpenseFunds(1000n, expenses), 800n);
  assert.equal(availableExpenseFunds(100n, expenses), 0n);
});

test("the reported 500 TRY expense pauses before execution and resumes with the same quote after funding", () => {
  const expense = {
    status: ["Pending"],
    max_usdc: 113400000n,
    quote: [
      "Prepared",
      { amount_usdc: 103005949n, expires_at: 500, expires_time: 1000n },
    ],
  };
  const original = structuredClone(expense);
  assert.deepEqual(expensePaymentBlock(expense, 81584362n, 100, 100000), {
    phase: "awaiting-funds",
    reason: "INSUFFICIENT_TREASURY_BALANCE",
    availableUsdc: "8.1584362",
    requiredUsdc: "10.3005949",
  });
  assert.equal(expensePaymentBlock(expense, 103005949n, 100, 100000), null);
  assert.deepEqual(expense, original);
});

test("an unfunded expense cannot open an order, expired quotes pause, disbursed orders can settle", () => {
  const unquoted = {
    status: ["Pending"],
    max_usdc: 22700000n,
    quote: ["Missing"],
  };
  assert.equal(
    expensePaymentBlock(unquoted, 0n, 100, 100000)?.phase,
    "awaiting-funds",
  );
  assert.equal(expensePaymentBlock(unquoted, 22700000n, 100, 100000), null);
  const quoted = {
    ...unquoted,
    quote: [
      "Prepared",
      { amount_usdc: 20000000n, expires_at: 500, expires_time: 1000n },
    ],
  };
  for (const [ledger, now] of [
    [500, 100000],
    [100, 1000000],
  ])
    assert.deepEqual(expensePaymentBlock(quoted, 30000000n, ledger, now), {
      phase: "needs-review",
      reason: "QUOTE_EXPIRED",
    });
  assert.equal(
    expensePaymentBlock({ ...quoted, status: ["Disbursed"] }, 0n, 100, 100000),
    null,
  );
});

test("local passkeys prefer the platform and preserve required verification and signed challenge", () => {
  assert.deepEqual(registrationSelection(), {
    authenticatorAttachment: "platform",
    residentKey: "required",
  });
  assert.equal(
    registrationSelection("other").authenticatorAttachment,
    undefined,
  );
  const request = {
    optionsJSON: {
      challenge: "signed-challenge",
      rpId: "duly.example",
      allowCredentials: [{ id: "existing-key", type: "public-key" }],
      userVerification: "required",
    },
  };
  const result = authenticationOptions(request);
  assert.deepEqual(result.optionsJSON.hints, ["client-device"]);
  assert.equal(result.optionsJSON.userVerification, "required");
  assert.equal(result.optionsJSON.challenge, request.optionsJSON.challenge);
  assert.deepEqual(
    result.optionsJSON.allowCredentials,
    request.optionsJSON.allowCredentials,
  );
  assert.deepEqual(authenticationOptions(request, "other").optionsJSON.hints, [
    "hybrid",
    "security-key",
  ]);
});
