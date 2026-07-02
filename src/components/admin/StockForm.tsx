"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { addCards, type CardActionState } from "@/app/admin/actions";

export function StockForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<
    CardActionState | null,
    FormData
  >(addCards, null);
  const formRef = useRef<HTMLFormElement>(null);

  // 进货成功后清空输入框（新卡密会出现在上方列表里）。
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-5 border-t border-separator pt-4"
    >
      <input type="hidden" name="productId" value={productId} />
      <TextField name="secrets" isRequired isDisabled={pending}>
        <Label>进货卡密（每行一个）</Label>
        <TextArea
          rows={3}
          className="font-mono"
          placeholder={"CARD-AAAA-1111\nCARD-BBBB-2222"}
        />
      </TextField>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" variant="secondary" isDisabled={pending}>
          {pending && <Spinner size="sm" color="current" />}
          {pending ? "进货中…" : "进货"}
        </Button>
        {state && (
          <span
            className={`text-xs ${state.ok ? "text-success" : "text-warning"}`}
            role="status"
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
