import assert from "node:assert/strict";
import test from "node:test";
import { formatOrderCreatedMessage } from "../src/lib/feishu.ts";
import { parsePriceCommandArgs } from "../src/lib/price-command.ts";

test("parsePriceCommandArgs accepts product names and exact cents", () => {
  assert.deepEqual(parsePriceCommandArgs("GPT Plus 19.9"), {
    ok: true,
    productTarget: "GPT Plus",
    newPriceCents: 1990,
  });
  assert.deepEqual(parsePriceCommandArgs("1 ￥0.01"), {
    ok: true,
    productTarget: "1",
    newPriceCents: 1,
  });
});

test("parsePriceCommandArgs rejects ambiguous or unsafe amounts", () => {
  assert.equal(parsePriceCommandArgs("1 19.999").ok, false);
  assert.equal(parsePriceCommandArgs("1 -1").ok, false);
  assert.equal(parsePriceCommandArgs("1 1e3").ok, false);
  assert.equal(parsePriceCommandArgs("1 100000.01").ok, false);
  assert.equal(parsePriceCommandArgs("19.9").ok, false);
});

test("formatOrderCreatedMessage includes the requested order fields", () => {
  const message = formatOrderCreatedMessage({
    tradeOrderId: "FK123",
    productName: "GPT Plus",
    email: "buyer@example.com",
    amountCents: 1990,
    createdAt: "2026-08-14T05:30:00.000Z",
  });

  assert.match(message, /新订单（待支付）/);
  assert.match(message, /GPT Plus/);
  assert.match(message, /buyer@example\.com/);
  assert.match(message, /¥19\.90/);
  assert.match(message, /2026-08-14 13:30:00/);
  assert.match(message, /FK123/);
});
