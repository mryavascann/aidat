/** @param {string} value */
export function normalizeIban(value) {
  if (typeof value !== "string")
    throw new Error("Geçerli bir Türkiye IBAN’ı girin.");
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(iban))
    throw new Error("Geçerli bir Türkiye IBAN’ı girin.");
  let remainder = 0;
  for (const digit of iban.slice(4) + "2927" + iban.slice(2, 4))
    remainder = (remainder * 10 + Number(digit)) % 97;
  if (remainder !== 1) throw new Error("IBAN kontrol basamakları geçersiz.");
  return iban;
}
/** @param {string} iban */
export async function recipientId(iban) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`duly:iban:v1:${normalizeIban(iban)}`),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
/** @param {string} iban */
export function formatIban(iban) {
  return normalizeIban(iban)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}
