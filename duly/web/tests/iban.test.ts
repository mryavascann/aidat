import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIban, recipientId } from "../src/lib/iban.ts";

test("bank recipients use normalized Turkish IBANs with a verified checksum", async () => {
  const iban = "TR330006100519786457841326";
  assert.equal(normalizeIban("tr33 0006 1005 1978 6457 8413 26"), iban);
  assert.equal(
    await recipientId(iban),
    await recipientId("TR33 0006 1005 1978 6457 8413 26"),
  );
  assert.throws(() => normalizeIban("TR330006100519786457841327"));
  assert.throws(() => normalizeIban("DE89370400440532013000"));
  assert.throws(() => normalizeIban("TR33<script>"));
});
