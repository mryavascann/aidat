import {
  buildingCopy,
  buildingMessageKey,
  type BuildingKey,
} from "../i18n/building.ts";

const contractErrors: Record<number, BuildingKey> = {
  1: "alreadyProcessed",
  2: "buildingUnavailable",
  3: "invalidAmount",
  4: "permissionDenied",
  5: "permissionDenied",
  6: "errorGeneric",
  7: "permissionDenied",
  8: "buildingNotFound",
  9: "alreadyProcessed",
  10: "majorityRequired",
  11: "waitForNotice",
  12: "permissionDenied",
  13: "alreadyProcessed",
  14: "errorGeneric",
  15: "budgetExceeded",
  16: "recipientNotApproved",
  17: "bankQuoteMismatch",
  18: "existingPayment",
  19: "quoteExpired",
  20: "existingPayment",
  21: "insufficientTreasury",
  22: "invalidAmount",
  23: "serviceUnavailable",
  24: "serviceUnavailable",
  25: "existingPayment",
};

/** Translate at render time, including errors produced before a language switch. */
export function actionErrorKey(value: string): BuildingKey {
  const known = buildingMessageKey(value);
  if (known) return known;
  const code = value.match(/Error\(Contract,\s*#(\d+)\)/)?.[1];
  if (code) return contractErrors[Number(code)] ?? "errorGeneric";
  if (/INSUFFICIENT_TREASURY_BALANCE/i.test(value))
    return "insufficientTreasury";
  if (/QUOTE_EXPIRED|quote.*expir|quote is no longer ready/i.test(value))
    return "quoteExpired";
  if (/PASSKEY_DEVICE_UNAVAILABLE|does not support passkeys/i.test(value))
    return "devicePasskeyUnavailable";
  if (
    /notallowederror|cancelled|canceled|timed out or was not allowed/i.test(
      value,
    )
  )
    return "passkeyCancelled";
  if (/IBAN.*(invalid|must|checksum)|Invalid.*IBAN/i.test(value))
    return "invalidIban";
  if (/only the current manager|not authorized|not a voter/i.test(value))
    return "permissionDenied";
  if (/positive amount|Invalid.*amount/i.test(value)) return "invalidAmount";
  if (/quote exceeds/i.test(value)) return "bankQuoteTooHigh";
  if (/does not match|differs from|routing does not match/i.test(value))
    return "bankQuoteMismatch";
  if (
    /already attached|saved bank reference|existing bank payment/i.test(value)
  )
    return "existingPayment";
  if (/not found|Building is unavailable|Invalid building/i.test(value))
    return "buildingNotFound";
  if (/fetch|network|unavailable|timeout/i.test(value))
    return "serviceUnavailable";
  return "errorGeneric";
}

export const actionErrorMessage = (value: string, lang: "tr" | "en") =>
  buildingCopy(lang)(actionErrorKey(value));
