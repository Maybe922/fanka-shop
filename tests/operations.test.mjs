import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPaidOrderMessage,
  sendFeishuPaidOrder,
} from "../src/lib/feishu.ts";
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

test("paid order notices prefer owner DM and fall back to the operations group", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    ownerOpenId: process.env.FEISHU_OWNER_OPEN_ID,
    chatId: process.env.FEISHU_CHAT_ID,
  };
  const messageCalls = [];
  let ownerShouldFail = false;

  process.env.FEISHU_APP_ID = "cli_test";
  process.env.FEISHU_APP_SECRET = "secret_test";
  process.env.FEISHU_OWNER_OPEN_ID = "ou_owner";
  process.env.FEISHU_CHAT_ID = "oc_group";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("tenant_access_token")) {
      return Response.json({
        code: 0,
        tenant_access_token: "tenant_test",
        expire: 7200,
      });
    }

    const receiveIdType = new URL(url).searchParams.get("receive_id_type");
    const body = JSON.parse(String(init?.body));
    messageCalls.push({ receiveIdType, receiveId: body.receive_id });
    if (receiveIdType === "open_id" && ownerShouldFail) {
      return Response.json({ code: 230013 });
    }
    return Response.json({ code: 0 });
  };

  try {
    const baseOrder = {
      productName: "GPT Plus",
      email: "buyer@example.com",
      amountCents: 14800,
      paidAt: "2026-08-16T11:46:05.000Z",
    };

    assert.equal(
      await sendFeishuPaidOrder({ ...baseOrder, tradeOrderId: "FK-DM" }),
      true,
    );
    assert.deepEqual(messageCalls, [
      { receiveIdType: "open_id", receiveId: "ou_owner" },
    ]);

    messageCalls.length = 0;
    ownerShouldFail = true;
    assert.equal(
      await sendFeishuPaidOrder({ ...baseOrder, tradeOrderId: "FK-GROUP" }),
      true,
    );
    assert.deepEqual(messageCalls, [
      { receiveIdType: "open_id", receiveId: "ou_owner" },
      { receiveIdType: "chat_id", receiveId: "oc_group" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({
      FEISHU_APP_ID: originalEnv.appId,
      FEISHU_APP_SECRET: originalEnv.appSecret,
      FEISHU_OWNER_OPEN_ID: originalEnv.ownerOpenId,
      FEISHU_CHAT_ID: originalEnv.chatId,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
