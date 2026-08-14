import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * 在数据库中原子认领一条机器人消息。
 *
 * 飞书可能重复推送同一个 message_id；数据库主键保证即使两个请求并发到达，
 * 也只有一个请求会真正执行补货。表未迁移属于部署错误，直接抛出而不是冒险入库。
 */
export async function claimBotMessage(
  supabase: ServiceClient,
  provider: "feishu" | "telegram",
  messageId: string,
  eventId?: string,
): Promise<boolean> {
  const { error } = await supabase.from("bot_events").insert({
    provider,
    message_id: messageId,
    event_id: eventId || null,
    status: "processing",
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`机器人事件去重失败：${error.message}`);
}

export async function finishBotMessage(
  supabase: ServiceClient,
  provider: "feishu" | "telegram",
  messageId: string,
  status: "completed" | "failed",
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase
    .from("bot_events")
    .update({
      status,
      last_error: errorMessage?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("message_id", messageId);

  if (error) {
    console.error("[bot-events] 更新处理状态失败", error.message);
  }
}
