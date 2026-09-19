import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  body,
  Keypair,
  seal,
  unseal,
  derivedKey,
  xdr,
} from "../server/runtime.mjs";
import { validateSponsoredFunction } from "../server/relay.mjs";
process.env.DULY_BANK_SECRET = Keypair.random().secret();
test("saved bank routes reject tampering and remain tied to the server key", () => {
  const route = {
    kind: "withdraw",
    treasury: "C...",
    id: 7,
    iban: "TR330006100519786457841326",
  };
  const token = seal(route);
  assert.deepEqual(unseal(token), route);
  const raw = Buffer.from(token, "base64url");
  raw[30] ^= 1;
  assert.throws(() => unseal(raw.toString("base64url")));
  const secret = process.env.DULY_BANK_SECRET;
  process.env.DULY_BANK_SECRET = Keypair.random().secret();
  assert.throws(() => unseal(token));
  process.env.DULY_BANK_SECRET = secret;
  assert.equal(
    derivedKey("expense:a:1").publicKey(),
    derivedKey("expense:a:1").publicKey(),
  );
  assert.notEqual(
    derivedKey("expense:a:1").publicKey(),
    derivedKey("expense:a:2").publicKey(),
  );
});
test("API JSON parsing supports Node streams and Vercel parsed/string bodies with the same limits", async () => {
  const base = {
    method: "POST",
    headers: { "content-type": "application/json" },
  };
  for (const payload of [
    { action: "config" },
    '{"action":"config"}',
    Buffer.from('{"action":"config"}'),
  ])
    assert.deepEqual(await body({ ...base, body: payload }), {
      action: "config",
    });
  const stream = Readable.from(['{"action":', '"config"}']);
  Object.assign(stream, base);
  assert.deepEqual(await body(stream), { action: "config" });
  await assert.rejects(() =>
    body({ ...base, body: { large: "x".repeat(128001) } }),
  );
  await assert.rejects(() => body({ ...base, body: [] }));
  await assert.rejects(() => body({ ...base, method: "GET" }));
});
test("fee sponsor rejects unrelated deployment bytecode without signing it", async () => {
  const bad = xdr.HostFunction.hostFunctionTypeUploadContractWasm(
    Buffer.from([1, 2, 3]),
  );
  await assert.rejects(() => validateSponsoredFunction(bad), /Unsupported/);
});
