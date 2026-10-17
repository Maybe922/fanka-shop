import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { reserveOrder } from "../src/lib/reserve-order.ts";

function loadModule(path, imports) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  new Function("require", "exports", outputText)((id) => {
    assert.ok(id in imports, `Unexpected dependency: ${id}`);
    return imports[id];
  }, exports);
  return exports;
}

function orderScenario({ status = "pending", overdue = false, paid = false, buyer = "buyer", cardOwner = "order", deliveryError = false } = {}) {
  let order = {
    id: "order", status, card_id: status === "expired" ? null : "card",
    product_id: "product", trade_order_id: "trade", user_id: "buyer", payment_method: "wechat",
    expires_at: new Date(Date.now() + (overdue ? -60000 : 60000)).toISOString(),
  };
  const calls = [];
  const supabase = {
    from(table) {
      const filters = {};
      return {
        select() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        async single() {
          calls.push(`read:${table}`);
          if (table === "orders") return { data: { ...order } };
          if (table === "cards") {
            assert.equal(filters.status, "sold");
            assert.equal(filters.order_id, order.id);
            return { data: cardOwner === filters.order_id ? { secret: "TEST_SECRET" } : null };
          }
          return { data: { name: "Test product" } };
        },
      };
    },
    async rpc(name) {
      calls.push(name);
      if (name === "deliver_order") {
        if (deliveryError) return { error: { message: "test delivery failure" } };
        order = { ...order, status: "paid", card_id: "card" };
      }
      if (name === "expire_stale_orders") order = { ...order, status: "expired", card_id: null };
      return { error: null };
    },
  };
  const route = loadModule("../src/app/api/orders/[id]/route.ts", {
    "next/server": { after() {} },
    "@/lib/supabase/server": { createServiceClient: () => supabase },
    "@/lib/supabase/auth-server": { getBuyer: async () => buyer ? { id: buyer } : null },
    "@/lib/xunhupay": { queryXunhuOrder: async () => { calls.push("query-payment"); return { paid }; } },
    "@/lib/alert": { notifyStockOutIfNeeded: async () => {}, notifyProductSoldOutIfNeeded: async () => {} },
    "@/lib/paid-order-notice": { notifyFeishuPaidOrderIfNeeded: async () => {} },
  });
  return {
    calls,
    request: () => route.GET(new Request("http://localhost/api/orders/order"), { params: Promise.resolve({ id: "order" }) }),
  };
}

test("unpaid reserved orders never read or return a card secret", async () => {
  const scenario = orderScenario();
  const response = await scenario.request();
  assert.equal((await response.json()).secret, null);
  assert.ok(!scenario.calls.includes("read:cards"));
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("paid orders return only their own sold card", async () => {
  const response = await orderScenario({ status: "paid" }).request();
  assert.equal((await response.json()).secret, "TEST_SECRET");
  const wrongCard = await orderScenario({ status: "paid", cardOwner: "another-order" }).request();
  assert.equal((await wrongCard.json()).secret, null);
});

test("other users and logged-out visitors cannot query payment or read cards", async () => {
  for (const buyer of ["other-buyer", null]) {
    const scenario = orderScenario({ buyer });
    assert.equal((await scenario.request()).status, 403);
    assert.deepEqual(scenario.calls, ["read:orders"]);
  }
});

test("expired paid orders are reconciled and delivered", async () => {
  const scenario = orderScenario({ status: "expired", overdue: true, paid: true });
  const response = await scenario.request();
  const payload = await response.json();
  assert.equal(payload.status, "paid");
  assert.equal(payload.secret, "TEST_SECRET");
  assert.ok(scenario.calls.includes("deliver_order"));
});

test("overdue orders check payment before releasing stock", async () => {
  const paid = orderScenario({ overdue: true, paid: true });
  assert.equal((await (await paid.request()).json()).status, "paid");
  assert.ok(!paid.calls.includes("expire_stale_orders"));
  const unpaid = orderScenario({ overdue: true });
  assert.equal((await (await unpaid.request()).json()).status, "expired");
  assert.ok(unpaid.calls.indexOf("query-payment") < unpaid.calls.indexOf("expire_stale_orders"));
});

test("delivery failures return a retryable error without revealing a card", async () => {
  const scenario = orderScenario({ paid: true, deliveryError: true });
  assert.equal((await scenario.request()).status, 503);
  assert.ok(!scenario.calls.includes("read:cards"));
});

test("storefront releases expired reservations before reading stock", async () => {
  const calls = [];
  const data = loadModule("../src/lib/data.ts", {
    "@/lib/env": { hasSupabaseConfig: () => true },
    "@/lib/supabase/server": { createServiceClient: () => ({ rpc: async (name) => { calls.push(name); return { error: null }; } }) },
    "@/lib/supabase/public": { createPublicClient: () => ({ from: () => ({ select: async () => { calls.push("read-stock"); return { data: [], error: null }; } }) }) },
  });
  await data.getPublicProducts();
  assert.deepEqual(calls, ["expire_stale_orders", "read-stock"]);
});

test("atomic reservation never falls back after a limit or database error", async () => {
  for (const message of ["ORDER_LIMIT_PENDING", "ORDER_LIMIT_IP", "ORDER_LIMIT_HOURLY", "database unavailable"]) {
    const calls = [];
    const db = { rpc: async (name, params) => { calls.push({ name, params }); return { data: null, error: { code: "P0001", message } }; } };
    const result = await reserveOrder(db, { p_user_id: "buyer" }, "127.0.0.1");
    assert.equal(result.error.message, message);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "create_order_reserved_limited");
    assert.equal(calls[0].params.p_ip, "127.0.0.1");
  }
});

test("reservation compatibility applies only when the migration is absent", async () => {
  const calls = [];
  const db = { rpc: async (name) => { calls.push(name); return name.endsWith("_limited") ? { error: { code: "PGRST202" } } : { data: "order", error: null }; } };
  assert.equal((await reserveOrder(db, {}, null)).data, "order");
  assert.deepEqual(calls, ["create_order_reserved_limited", "create_order_reserved"]);
});
