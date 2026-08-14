import assert from "node:assert/strict";
import test from "node:test";
import { formatPaidOrderMessage } from "../src/lib/feishu.ts";
import { parsePriceCommandArgs } from "../src/lib/price-command.ts";
import { isAuthorizedFeishuChat } from "../src/lib/feishu-access.ts";

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

test("formatPaidOrderMessage includes paid status and requested fields", () => {
  const message = formatPaidOrderMessage({
    tradeOrderId: "FK123",
    productName: "GPT Plus",
    email: "buyer@example.com",
    amountCents: 1990,
    paidAt: "2026-08-14T05:30:00.000Z",
  });

  assert.match(message, /订单支付成功/);
  assert.match(message, /GPT Plus/);
  assert.match(message, /buyer@example\.com/);
  assert.match(message, /¥19\.90/);
  assert.match(message, /2026-08-14 13:30:00/);
  assert.match(message, /FK123/);
  assert.doesNotMatch(message, /待支付/);
});

test("private Feishu commands require the exact owner open_id", () => {
  const base = {
    chatId: "oc_private",
    chatType: "p2p",
    ownerChatId: "oc_group",
    ownerOpenId: "ou_owner",
  };
  assert.equal(
    isAuthorizedFeishuChat({ ...base, senderOpenId: "ou_owner" }),
    true,
  );
  assert.equal(
    isAuthorizedFeishuChat({ ...base, senderOpenId: "ou_someone_else" }),
    false,
  );
  assert.equal(
    isAuthorizedFeishuChat({ ...base, senderOpenId: undefined }),
    false,
  );
  assert.equal(
    isAuthorizedFeishuChat({
      ...base,
      chatId: "oc_group",
      chatType: "group",
      senderOpenId: "ou_any_group_member",
    }),
    true,
  );
});
