import { redirect } from "next/navigation";

// 后台已改为邮箱白名单鉴权，不再有独立密码登录页。
// 保留此路由只为兼容旧链接，统一跳到买家登录页并带上回跳。
export default function AdminLoginRedirect() {
  redirect("/login?next=/admin");
}
