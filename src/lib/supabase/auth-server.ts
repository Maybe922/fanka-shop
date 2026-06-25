import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { User } from "@supabase/supabase-js";

// Cookie 绑定的 Supabase 客户端 —— 用于「买家」会话（anon key + RLS）。
// 可在 server component / route handler / server action 中使用。
// 注意：这套是买家登录态，和后台 admin（ADMIN_PASSWORD + 自定义 cookie）互不相干。
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 从 Server Component 调用时 cookie 只读会抛错 —— 忽略即可，
          // 会话刷新由 proxy.ts 负责。
        }
      },
    },
  });
}

// 当前登录买家（未登录返回 null）。用 getUser() 而非 getSession()：
// 它会向 Supabase 校验 JWT，不能伪造。
export async function getBuyer(): Promise<User | null> {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return null;
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
