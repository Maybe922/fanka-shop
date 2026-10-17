import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;
type ReserveParams = {
  p_product_id: string;
  p_trade_order_id: string;
  p_amount_cents: number;
  p_user_id: string;
  p_email: string | null;
  p_expires_at: string;
};

export const ORDER_LIMIT_ERRORS: Record<string, string> = {
  ORDER_LIMIT_PENDING: "你有多笔未完成的订单，请先付款或等它们超时后再下单",
  ORDER_LIMIT_IP: "当前网络下单过于频繁，请稍后再试",
  ORDER_LIMIT_HOURLY: "下单太频繁了，请一小时后再试",
};

export async function reserveOrder(
  supabase: ServiceClient,
  params: ReserveParams,
  ip: string | null,
) {
  const result = await supabase.rpc("create_order_reserved_limited", {
    ...params,
    p_ip: ip,
  });
  // 允许应用先部署。仅在新函数尚未安装时保留旧流程；其他错误不得绕过限额。
  if (result.error?.code !== "PGRST202") return result;
  console.warn("[orders] 请执行 20260929_atomic_order_limits.sql 以启用原子下单限额");
  return supabase.rpc("create_order_reserved", params);
}
