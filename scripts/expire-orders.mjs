// 每分钟运行一次：node --env-file=.env.local scripts/expire-orders.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("缺少 Supabase 配置");
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
  },
});
const { data, error } = await supabase.rpc("expire_stale_orders");
if (error) {
  console.error("[expire-orders]", error.message);
  process.exitCode = 1;
} else if (data > 0) {
  console.log(new Date().toISOString(), "已回收过期订单", data);
}
