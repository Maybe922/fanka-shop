"use client";

import { useActionState } from "react";
import { Button, Chip, Input, Spinner, TextField } from "@heroui/react";
import {
  updateCardSecret,
  deleteCard,
  type CardActionState,
} from "@/app/admin/actions";
import type { AdminCard } from "@/lib/types";

export function CardRow({ card }: { card: AdminCard }) {
  const [saveState, saveAction, saving] = useActionState<
    CardActionState | null,
    FormData
  >(updateCardSecret, null);
  const [delState, delAction, deleting] = useActionState<
    CardActionState | null,
    FormData
  >(deleteCard, null);

  // 这里只会收到未售 / 占用中（已售已移到最近订单）。
  const reserved = card.status === "reserved";
  // 删除成功时该行会随 revalidate 消失；只需在出错时提示。
  const feedback = delState && !delState.ok ? delState : saveState;

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-2">
        <Chip
          size="sm"
          variant="soft"
          color={reserved ? "warning" : "success"}
          className="shrink-0"
          title={
            reserved
              ? "已被一笔待支付订单占用，支付完成或超时后自动释放"
              : undefined
          }
        >
          {reserved ? "占用中" : "未售"}
        </Chip>

        <form action={saveAction} className="flex flex-1 items-center gap-1.5">
          <input type="hidden" name="cardId" value={card.id} />
          <TextField
            name="secret"
            defaultValue={card.secret}
            isRequired
            isDisabled={saving}
            aria-label="卡密内容"
            className="flex-1"
          >
            <Input className="font-mono text-xs" />
          </TextField>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            isDisabled={saving}
            className="shrink-0"
          >
            {saving && <Spinner size="sm" color="current" />}
            {saving ? "保存中" : "保存"}
          </Button>
        </form>

        {reserved ? (
          <span className="w-[3.75rem] shrink-0" aria-hidden />
        ) : (
          <form action={delAction}>
            <input type="hidden" name="cardId" value={card.id} />
            <Button
              type="submit"
              variant="danger-soft"
              size="sm"
              isDisabled={deleting}
              className="shrink-0"
            >
              {deleting && <Spinner size="sm" color="current" />}
              {deleting ? "删除中" : "删除"}
            </Button>
          </form>
        )}
      </div>

      {feedback && (
        <p
          className={`pl-1 text-[11px] ${
            feedback.ok ? "text-success" : "text-warning"
          }`}
          role="status"
        >
          {feedback.message}
        </p>
      )}
    </li>
  );
}
