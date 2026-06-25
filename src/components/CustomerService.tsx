import { site } from "@/lib/site";

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

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M9 3C4.86 3 1.5 5.86 1.5 9.39c0 1.97 1.06 3.73 2.72 4.9l-.68 2.05 2.4-1.2c.86.24 1.78.37 2.73.37.2 0 .4 0 .6-.02a5.5 5.5 0 0 1-.27-1.7c0-3.2 3.04-5.79 6.78-5.79.25 0 .5.02.74.04C15.84 4.7 12.72 3 9 3Zm-2.7 4.2a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92Zm5.4 0a.96.96 0 1 1 0 1.92.96.96 0 0 1 0-1.92Z" />
      <path d="M22.5 13.64c0-2.94-2.86-5.32-6.39-5.32s-6.39 2.38-6.39 5.32 2.86 5.32 6.39 5.32c.78 0 1.53-.11 2.22-.31l1.96.98-.54-1.66c1.66-.97 2.75-2.5 2.75-4.33Zm-8.3-1.06a.78.78 0 1 1 0-1.56.78.78 0 0 1 0 1.56Zm3.82 0a.78.78 0 1 1 0-1.56.78.78 0 0 1 0 1.56Z" />
    </svg>
  );
}

/**
 * 客服联系方式。
 * 桌面端（md+）直接平铺显示 TG + 微信，利于信任；
 * 移动端收成一个「客服」原生 details 浮层，避免挤爆小屏。
 */
export function CustomerService() {
  return (
    <>
      {/* ── 桌面：平铺 ───────────────────────────────── */}
      <div className="hidden items-center gap-2 font-mono text-[12px] md:flex">
        <span className="flex items-center gap-1.5 text-muted">
          <HeadsetIcon className="h-3.5 w-3.5" />
          客服
        </span>
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink transition-colors hover:border-accent hover:text-accent"
        >
          <TelegramIcon className="h-3.5 w-3.5" />
          {telegram}
        </a>
        <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink">
          <WechatIcon className="h-3.5 w-3.5 text-ok" />
          微信&nbsp;{wechat}
        </span>
      </div>

      {/* ── 移动：点开浮层 ──────────────────────────── */}
      <details className="cs-pop relative md:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[12px] text-muted [&::-webkit-details-marker]:hidden">
          <HeadsetIcon className="h-3.5 w-3.5" />
          客服
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-[0_18px_40px_-22px_rgba(27,23,19,0.45)]">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-sunken"
          >
            <TelegramIcon className="h-4 w-4 text-accent" />
            <span className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Telegram
              </span>
              <span className="font-mono text-[13px] text-ink">{telegram}</span>
            </span>
          </a>
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <WechatIcon className="h-4 w-4 text-ok" />
            <span className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Wechat
              </span>
              <span className="font-mono text-[13px] text-ink">{wechat}</span>
            </span>
          </div>
        </div>
      </details>
    </>
  );
}
