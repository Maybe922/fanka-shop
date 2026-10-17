import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { ADDRESS_RE, USDT_TOKEN, TRANSFER_TOPIC, atomicAmount, asHex, checkedHead, getLiveRate, hexNumber, makeRpc, matchingTransfer, recipientTopic, verifyTransfer, withVerificationFallback } from "./core";
import type { RpcBlock, RpcLog } from "./core";

export type UsdtPayment = {
  order_id: string; recipient: string; token: string; chain_id: number;
  amount_micros: number; rate_cny: number; rate_fetched_at: string;
  start_block: number; scanned_to: number; created_at: string; expires_at: string;
  state: "watching" | "paid" | "expired" | "review"; checked_at: string | null;
};
export function usdtEnabled(): boolean {
  return process.env.USDT_BEP20_ENABLED === "true" && ADDRESS_RE.test(process.env.USDT_BEP20_ADDRESS ?? "") &&
    Boolean(process.env.USDT_RECONCILE_SECRET);
}
function rpcClient() {
  return withVerificationFallback(
    makeRpc(process.env.USDT_BEP20_RPC_URL || "https://bsc-rpc.publicnode.com"),
    makeRpc(process.env.USDT_BEP20_VERIFY_RPC_URL || "https://bsc-dataseed.bnbchain.org"),
  );
}
export async function prepareUsdtQuote() {
  if (!usdtEnabled()) throw new Error("USDT disabled");
  const rpc = rpcClient();
  const [rate] = await Promise.all([getLiveRate(), checkedHead(rpc)]);
  const block = await rpc<RpcBlock>("eth_getBlockByNumber", ["latest", false]);
  const decimals = await rpc<string>("eth_call", [{ to: USDT_TOKEN, data: "0x313ce567" }, "latest"]);
  if (hexNumber(decimals) !== 18) throw new Error("Token decimals changed");
  return { ...rate, recipient: process.env.USDT_BEP20_ADDRESS!.toLowerCase(), startBlock: hexNumber(block.number) };
}
export async function getUsdtPayment(orderId: string) {
  const { data, error } = await createServiceClient().from("usdt_payments").select("*").eq("order_id", orderId).single();
  if (error) throw new Error("USDT order unavailable");
  return data as UsdtPayment;
}

// Only the authenticated scheduled worker runs chain reconciliation. Buyer polling only reads DB.
export async function reconcileUsdtPayments() {
  const db = createServiceClient();
  const rpc = rpcClient();
  const { data, error } = await db.from("usdt_payments").select("*").eq("state", "watching").eq("chain_id", 56)
    .order("checked_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) throw new Error("Payment queue unavailable");
  const delivered: string[] = [];
  const reviewed: string[] = [];
  if (!data?.length) return { delivered, reviewed };
  const head = await checkedHead(rpc);
  const finalized = hexNumber(head.number);
  const deadline = Date.now() + 45000;
  for (const quote of (data ?? []) as UsdtPayment[]) {
    if (Date.now() > deadline) break;
    // Advance only after an entire batch has been verified. No cursor advance on RPC/DB failure.
    let cursor = quote.scanned_to;
    for (let page = 0; page < 8 && cursor < finalized && Date.now() < deadline; page++) {
      const end = Math.min(cursor + 1000, finalized);
      const logs = await rpc<RpcLog[]>("eth_getLogs", [{
        address: USDT_TOKEN, fromBlock: asHex(cursor + 1), toBlock: asHex(end),
        topics: [TRANSFER_TOPIC, null, recipientTopic(quote.recipient)],
      }]);
      if (!Array.isArray(logs)) throw new Error("Invalid log response");
      const matches = logs.filter(log => matchingTransfer(log, quote.recipient, quote.amount_micros))
        .sort((a, b) => hexNumber(a.blockNumber) - hexNumber(b.blockNumber) || hexNumber(a.logIndex) - hexNumber(b.logIndex));
      let settled = false;
      for (const log of matches) {
        if (hexNumber(log.blockNumber) <= cursor || hexNumber(log.blockNumber) > end) throw new Error("Log outside requested range");
        const verified = await verifyTransfer(rpc, log, quote, finalized);
        const result = await db.rpc("settle_usdt_payment", {
          p_order_id: quote.order_id, p_tx_hash: verified.txHash, p_log_index: verified.logIndex,
          p_block_number: verified.blockNumber, p_block_hash: verified.blockHash, p_block_time: verified.blockTime,
          p_recipient: quote.recipient, p_token: USDT_TOKEN, p_amount_atomic: atomicAmount(quote.amount_micros),
        });
        if (result.error) throw new Error("Payment settlement failed");
        (result.data ? delivered : reviewed).push(quote.order_id);
        settled = true;
        break;
      }
      if (settled) break;
      const endBlock = end === finalized ? head : await rpc<RpcBlock>("eth_getBlockByNumber", [asHex(end), false]);
      const done = hexNumber(endBlock.timestamp) * 1000 > Date.parse(quote.expires_at);
      const update = await db.from("usdt_payments").update({
        scanned_to: end, checked_at: new Date().toISOString(), state: done ? "expired" : "watching",
      }).eq("order_id", quote.order_id).eq("state", "watching").eq("scanned_to", cursor);
      if (update.error) throw new Error("Payment scan checkpoint failed");
      cursor = end;
      if (done) break;
    }
  }
  return { delivered, reviewed };
}
