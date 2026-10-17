import { Button, Popover } from "@heroui/react";
import { site } from "@/lib/site";
import { WechatCopyButton } from "@/components/WechatCopyButton";

const { telegram, telegramUrl, wechat } = site.support;

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 13a8 8 0 0 1 16 0M4 13v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Zm16 0v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.94 4.6 18.7 19.9c-.24 1.08-.88 1.34-1.78.84l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.99.48l.35-5 9.1-8.22c.4-.35-.09-.55-.62-.2L4.2 12.9l-4.86-1.52c-1.06-.33-1.08-1.06.22-1.57L20.57 3c.88-.33 1.65.2 1.37 1.6Z" />
    </svg>
  );
}

/** 所有屏幕尺寸统一使用一个客服入口。 */
export function CustomerService() {
  return (
    <Popover>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 min-w-0 gap-1.5 rounded-lg px-2 text-[13px] font-normal text-muted sm:px-2.5"
      >
        <HeadsetIcon className="hidden h-4 w-4 sm:block" />
        客服
      </Button>
      <Popover.Content placement="bottom end" className="w-64 max-w-[calc(100vw-2rem)] p-2">
        <Popover.Dialog aria-label="联系客服">
          <WechatCopyButton wechat={wechat} variant="row" />
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-secondary"
          >
            <TelegramIcon className="h-4 w-4 text-accent" />
            <span className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Telegram
              </span>
              <span className="font-mono text-[13px]">{telegram}</span>
            </span>
          </a>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
