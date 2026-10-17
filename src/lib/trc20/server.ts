import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getLiveRate } from "@/lib/bep20/core";
import type { UsdtPayment } from "@/lib/bep20/server";
import { TRON_CHAIN_ID, TRON_TOKEN, checkedTronHead, latestTronHeight, makeTronApi, tronCandidates, validTronAddress, verifyTronTransfer } from "./core";

export function trc20Enabled() {
  return process.env.USDT_TRC20_ENABLED === "true" && validTronAddress(process.env.USDT_TRC20_ADDRESS ?? "") && Boolean(process.env.USDT_RECONCILE_SECRET);
}
const apiClient = () => makeTronApi(process.env.TRONGRID_API_KEY);
export async function prepareTrc20Quote() {
  if (!trc20Enabled()) throw new Error("TRC20 disabled");
  const api = apiClient();
  const [rate, , startBlock] = await Promise.all([getLiveRate(), checkedTronHead(api), latestTronHeight(api)]);
  return { ...rate, recipient: process.env.USDT_TRC20_ADDRESS!, startBlock };
}
export async function reconcileTrc20Payments() {
  const db = createServiceClient();
  const { data, error } = await db.from("usdt_payments").select("*").eq("state", "watching").eq("chain_id", TRON_CHAIN_ID)
    .order("checked_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) throw new Error("TRON queue unavailable");
  const delivered: string[] = [], reviewed: string[] = [];
  if (!data?.length) return { delivered, reviewed };
  const api = apiClient();
  const head = await checkedTronHead(api);
  const finalized = head.block_header.raw_data;
  const deadline = Date.now() + 45000;
  for (const quote of data as UsdtPayment[]) {
    if (Date.now() > deadline) break;
    try {
      const candidates = await tronCandidates(api, quote);
      let settled = false;
      for (const tx of candidates) {
        const proof = await verifyTronTransfer(api, tx, quote, finalized.number);
        const result = await db.rpc("settle_usdt_payment", {
          p_order_id: quote.order_id, p_tx_hash: proof.txHash, p_log_index: proof.logIndex,
          p_block_number: proof.blockNumber, p_block_hash: proof.blockHash, p_block_time: proof.blockTime,
          p_recipient: quote.recipient, p_token: TRON_TOKEN, p_amount_atomic: String(quote.amount_micros),
        });
        if (result.error) throw new Error("TRON settlement failed");
        (result.data ? delivered : reviewed).push(quote.order_id);
        settled = true; break;
      }
      if (!settled) {
        // Re-read the full window on every run: indexed history may lag finality. Keep
        // watching for 24 hours after expiry; late transfers go to manual review.
        const done = finalized.timestamp > Date.parse(quote.expires_at) + 86400000;
        const result = await db.from("usdt_payments").update({ checked_at: new Date().toISOString(), state: done ? "expired" : "watching" })
          .eq("order_id", quote.order_id).eq("state", "watching");
        if (result.error) throw new Error("TRON checkpoint failed");
      }
    } catch {
      // Leave the quote retryable; one unavailable receipt must not block other orders.
      console.error("[usdt-trc20] Order verification deferred:", quote.order_id);
    }
  }
  return { delivered, reviewed };
}
