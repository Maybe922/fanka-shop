"use client";

import { useActionState } from "react";
import {
  updateCardSecret,
  deleteCard,
  type CardActionState,
} from "@/app/admin/actions";
import type { AdminCard } from "@/lib/types";

function Spinner() {
  return (
    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

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
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
            reserved ? "bg-amber-100 text-amber-600" : "bg-ok/10 text-ok"
          }`}
          title={
            reserved
              ? "已被一笔待支付订单占用，支付完成或超时后自动释放"
              : undefined
          }
        >
          {reserved ? "占用中" : "未售"}
        </span>

        <form action={saveAction} className="flex flex-1 items-center gap-1.5">
          <input type="hidden" name="cardId" value={card.id} />
          <input
            name="secret"
            defaultValue={card.secret}
            required
            disabled={saving}
            className="w-full rounded-lg border border-line bg-bg px-2.5 py-1 font-mono text-xs outline-none focus:border-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {saving && <Spinner />}
            {saving ? "保存中" : "保存"}
          </button>
        </form>

        {reserved ? (
          <span className="w-[3.75rem] shrink-0" aria-hidden />
        ) : (
          <form action={delAction}>
            <input type="hidden" name="cardId" value={card.id} />
            <button
              type="submit"
              disabled={deleting}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-warn hover:text-warn disabled:opacity-60"
            >
              {deleting && <Spinner />}
              {deleting ? "删除中" : "删除"}
            </button>
          </form>
        )}
      </div>

      {feedback && (
        <p
          className={`pl-[3.25rem] text-[11px] ${
            feedback.ok ? "text-ok" : "text-warn"
          }`}
          role="status"
        >
          {feedback.message}
        </p>
      )}
    </li>
  );
}
