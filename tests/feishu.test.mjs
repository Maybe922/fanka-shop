import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  decryptFeishuEvent,
  verifyFeishuEventSignature,
} from "../src/lib/feishu.ts";

test("decryptFeishuEvent matches Feishu's official AES vector", () => {
  assert.equal(
    decryptFeishuEvent(
      "P37w+VZImNgPEO1RBhJ6RtKl7n6zymIbEG1pReEzghk=",
      "test key",
    ),
    "hello world",
  );
});

test("verifyFeishuEventSignature accepts only the matching raw body", () => {
  const timestamp = "1786672800";
  const nonce = "nonce-123";
  const encryptKey = "encrypt-key";
  const rawBody = '{"encrypt":"ciphertext"}';
  const signature = crypto
    .createHash("sha256")
    .update(timestamp + nonce + encryptKey + rawBody)
    .digest("hex");

  assert.equal(
    verifyFeishuEventSignature(
      timestamp,
      nonce,
      signature,
      rawBody,
      encryptKey,
    ),
    true,
  );
  assert.equal(
    verifyFeishuEventSignature(
      timestamp,
      nonce,
      signature,
      rawBody + " ",
      encryptKey,
    ),
    false,
  );
  assert.equal(
    verifyFeishuEventSignature(null, nonce, signature, rawBody, encryptKey),
    false,
  );
});
