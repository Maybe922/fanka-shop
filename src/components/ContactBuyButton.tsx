"use client";

import { Button, Modal } from "@heroui/react";
import { site } from "@/lib/site";
import { WechatCopyButton } from "@/components/WechatCopyButton";

const { telegram, telegramUrl, wechat, wechatQrUrl } = site.support;

type Props = {
  /** 结账页用大号通栏按钮；商品卡用默认尺寸。 */
  fullWidth?: boolean;
  label?: string;
};

/**
 * 客服定制商品的「联系购买」按钮：原地弹出微信二维码弹窗，
 * 附微信号一键复制与 Telegram 兜底，不跳离当前页面。
 */
export function ContactBuyButton({ fullWidth = false, label = "联系购买" }: Props) {
  return (
    <Modal>
      <Button
        variant="primary"
        fullWidth={fullWidth}
        size={fullWidth ? "lg" : "md"}
      >
        {label}
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>添加微信购买</Modal.Heading>
              <p className="mt-1 text-xs text-muted">
                扫码加好友，备注想要的商品，客服一对一定制。
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col items-center gap-3 pb-5">
              {/* 白底圆角容器：二维码在暗色主题下也保持可扫 */}
              <div className="overflow-hidden rounded-2xl border border-separator bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wechatQrUrl}
                  alt={`微信二维码 ${wechat}`}
                  width={592}
                  height={794}
                  className="h-auto w-56"
                />
              </div>
              <WechatCopyButton wechat={wechat} />
              <p className="text-[11px] text-muted">
                也可以 Telegram 联系{" "}
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent hover:underline"
                >
                  {telegram}
                </a>
              </p>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
