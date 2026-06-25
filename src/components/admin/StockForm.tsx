"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCards, type CardActionState } from "@/app/admin/actions";
import { fieldClass, labelClass } from "./form-styles";

function Spinner() {
  return (
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function StockForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<CardActionState | null, FormData>(
    addCards,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 进货成功后清空输入框（新卡密会出现在上方列表里）。
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-4 border-t border-line pt-4"
    >
      <input type="hidden" name="productId" value={productId} />
      <span className={labelClass}>进货卡密（每行一个）</span>
      <textarea
        name="secrets"
        rows={3}
        required
        disabled={pending}
        className={`${fieldClass} font-mono disabled:opacity-60`}
        placeholder={"CARD-AAAA-1111\nCARD-BBBB-2222"}
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Spinner />}
          {pending ? "进货中…" : "进货"}
        </button>
        {state && (
          <span
            className={`text-xs ${state.ok ? "text-ok" : "text-warn"}`}
            role="status"
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
