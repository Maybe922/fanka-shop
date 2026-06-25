import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Next.js 16：`middleware` 已更名为 `proxy`（文件 src/proxy.ts，默认 Node 运行时）。
// 作用：每次请求刷新买家的 Supabase 会话，并把刷新后的 cookie 写回响应，
// 保证 Server Component 读到的是最新会话。
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Supabase 未配置时直接放行，避免本地未配好就报错。
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // 重要：createServerClient 与 getUser() 之间不要插入其它逻辑，
  // 否则可能导致会话随机掉线（Supabase SSR 官方约定）。
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // 跑在除静态资源/图片外的所有路由上。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
