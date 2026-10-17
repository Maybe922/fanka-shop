"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { PaymentIcon } from "@/components/PaymentIcon";
import { site } from "@/lib/site";
import styles from "./purchase-demo.module.css";

import { RedemptionContent } from "./RedemptionDemo";

type Method = "wechat" | "usdt_bep20" | "usdt_trc20";
const chapters = [
  { label: "选商品", start: 0, end: 8, title: "选一款适合你的商品", note: "有库存的商品可以直接购买；标有「客服定制」的商品，请先联系客服。" },
  { label: "邮箱登录", start: 8, end: 16, title: "用常用邮箱登录", note: "输入邮箱、完成安全验证，再填写邮件中的 6 位验证码。订单会绑定这个邮箱。" },
  { label: "付款", start: 16, end: 29, title: "选择付款方式", note: "确认商品与金额后下单，进入收银台完成付款。" },
  { label: "取卡密", start: 29, end: 37, title: "到账后，自动发卡", note: "确认到账后，页面自动更新并展示卡密。点击「复制」，再查看下方的使用教程。" },
  { label: "按指引使用", start: 37, end: 45, title: "跟着交付页，完成最后一步", note: "按订单内的使用教程前往对应充值站，填写卡密并继续操作。不同商品以交付页说明为准。" },
];
const TOTAL = 45;
const photoRoot = "https://dtetbnnhdldloetfdakr.supabase.co/storage/v1/object/public/product-images/nature-subjects-20261016/";

function PlayIcon({ pause = false }: { pause?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20">{pause ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m8 4 12 8-12 8z" />}</svg>;
}
function Check() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="22" height="22"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" /><path d="m7 12 3 3 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function DemoButton({ children }: { children: React.ReactNode }) {
  return <div className={styles.demoButton}>{children}<span>→</span></div>;
}

function Scene({ step, method, progress, onContinue, continueRef }: { step: number; method: Method; progress: number; onContinue: () => void; continueRef: React.RefObject<HTMLButtonElement | null> }) {
  const network = method === "usdt_trc20" ? "TRC20 · TRON" : "BEP20 · BSC";
  const wechat = method === "wechat";
  return <div className={styles.scene} aria-label={`演示画面：${chapters[step].label}`}>
    <div className={styles.browserBar}>
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logoUrl} alt="" width="26" height="26" />双吉AI
      </div>
      <span className={styles.location}>{step === 0 ? "商品目录" : step === 1 ? "邮箱登录" : step === 2 ? "收银台" : "订单详情"}</span>
      <span className={styles.demoBadge}>操作示意</span>
    </div>
    <div key={`${step}-${method}`} className={styles.sceneContent}>
      {step === 0 && <div className={styles.catalog}>
        <div className={styles.sceneEyebrow}>AI 订阅，按需选择</div>
        <div className={styles.products}>
          <div className={`${styles.product} ${styles.selectedProduct}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${photoRoot}plus-card-v1.webp`} alt="花朵商品封面" width="480" height="270" />
            <div className={styles.productBody}><h3>ChatGPT Plus 卡充</h3><span className={styles.available}>有库存 · 自助购买</span><div className={styles.productFooter}><strong>¥130</strong><span className={styles.miniButton}>立即购买 →</span></div></div>
            <div className={styles.pointLabel}>选择商品，点击「立即购买」</div>
          </div>
          <div className={`${styles.product} ${styles.secondaryProduct}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${photoRoot}pro-100-ios-v1.webp`} alt="自然风格商品封面" width="480" height="270" />
            <div className={styles.productBody}><h3>ChatGPT Pro</h3><span className={styles.quiet}>客服定制</span><div className={styles.productFooter}><span>按需选择套餐</span><span className={styles.outlinePill}>联系购买</span></div></div>
          </div>
        </div>
        <p className={styles.finePrint}>商品与价格仅作演示，以当前商品页为准。</p>
      </div>}
      {step === 1 && <div className={styles.loginScene}>
        <div className={styles.mailIcon}>✉</div><h3>登录 / 注册</h3><p className={styles.quiet}>无需密码，验证码登录</p>
        <div className={styles.fakeField}><span>常用邮箱</span><strong>buyer@example.com</strong></div>
        <div className={styles.verified}><Check /> 安全验证通过</div>
        {progress < 0.45 ? <DemoButton>获取验证码</DemoButton> : <><div className={styles.codeRow}>{["•", "•", "•", "•", "•", "•"].map((c, i) => <span key={i}>{c}</span>)}</div><DemoButton>登录，继续购买</DemoButton></>}
        <p className={styles.finePrint}>首次登录自动创建账号；请保管好登录邮箱。</p>
      </div>}
      {step === 2 && <div className={styles.paymentScene}>
        <div className={styles.paymentMain}>
          <div className={styles.paymentHeading}><PaymentIcon method={method} /><h3>{wechat ? "微信扫码支付" : "USDT 链上转账"}</h3><span className={styles.outlinePill}>{wechat ? "微信" : network}</span></div>
          <div className={styles.amount}>{wechat ? "¥130" : "按收银台金额转账"}<span>{wechat ? "示意金额" : "包含末尾小数位"}</span></div>
          {wechat ? <div className={styles.scanPlaceholder}><div className={styles.scanCorners}><PaymentIcon method="wechat" /><span>支付二维码区域</span><small>演示示意 · 不可扫码</small></div><p>打开微信「扫一扫」<br /><strong>核对金额后确认付款</strong></p></div> : <div className={styles.addressBlock}><span>收款网络：{network}</span><code>{wechat ? "" : method === "usdt_bep20" ? "0x•••• … ••••" : "T•••• … ••••"}</code><p>从收银台复制完整收款地址<br /><strong>到账数量须与应付数量完全一致</strong></p></div>}
        </div>
        <div className={styles.paymentAside}><span className={styles.sceneEyebrow}>支付后，请耐心等待</span><h3>{progress > 0.7 ? "确认到账后\n自动展示卡密" : "正在等待付款确认"}</h3><div className={styles.waiting}><span />页面会自动更新</div><p>{wechat ? "支付成功后回到收银台，无需重复下单或付款。" : `请选择 ${network} 网络；交易所提币时，注意手续费可能影响实际到账数量。`}</p><div className={styles.softNote}>有效期以收银台倒计时为准</div></div>
      </div>}
      {step === 3 && <div className={styles.deliveryScene}>
        <div className={styles.successLine}><Check />支付成功，卡密已发放</div>
        <h3>你的卡密已准备好</h3><p className={styles.quiet}>在订单详情页查看并复制</p>
        <div className={styles.keyBox}><code>DEMO-XXXX-XXXX</code><span>{progress > 0.45 ? "✓ 已复制" : "复制卡密"}</span></div>
        <div className={styles.guideCard}><span className={styles.sceneEyebrow}>使用教程</span><p>前往交付页指定的充值站<br />使用刚刚复制的卡密，按页面指引继续</p></div>
        <p className={styles.finePrint}>这里展示的是示例卡密，不可用于充值。</p>
      </div>}
      {step === 4 && <div className={styles.finishScene}>
        <div className={styles.finishIcon}><Check /></div><h3>拿到卡密，接着完成兑换</h3>
        <div className={styles.finishSteps}><div><b>01</b><strong>阅读使用教程</strong><span>按交付页说明完成充值</span></div><div><b>02</b><strong>回到「我的订单」</strong><span>同一邮箱登录，找回订单与卡密</span></div><div><b>03</b><strong>需要帮助，联系客服</strong><span>保留订单号，方便核查处理</span></div></div>
        <div className={styles.finalNote}>付款成功 ≠ 订阅已开通，请继续查看兑换教程。</div>
        <button ref={continueRef} type="button" className={styles.continueButton} onClick={onContinue}><PlayIcon />继续查看兑换流程<span aria-hidden="true">→</span></button>
      </div>}
    </div>
  </div>;
}

export function PurchaseDemo({ compact = false, compactLabel = "看购买演示" }: { compact?: boolean; compactLabel?: string }) {
  const [showRedemption, setShowRedemption] = useState(false);
  const [redemptionAutoPlay, setRedemptionAutoPlay] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const backToPurchase = useCallback(() => {
    setShowRedemption(false);
    requestAnimationFrame(() => continueRef.current?.focus());
  }, []);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [method, setMethod] = useState<Method>("wechat");
  const ended = elapsed >= TOTAL;
  const step = chapters.findIndex(c => elapsed < c.end);
  const active = step < 0 ? chapters.length - 1 : step;
  const chapter = chapters[active];
  const progress = Math.min(1, (elapsed - chapter.start) / (chapter.end - chapter.start));

  useEffect(() => {
    if (!open || !playing || ended) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.5);
      previous = now;
      setElapsed(value => Math.min(TOTAL, value + delta));
    }, 100);
    return () => clearInterval(timer);
  }, [open, playing, ended]);
  useEffect(() => {
    function pauseWhenHidden() { if (document.hidden) setPlaying(false); }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  function changeOpen(value: boolean) {
    setOpen(value);
    setShowRedemption(false);
    if (value) { setElapsed(0); setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    else setPlaying(false);
  }
  const paymentNote = active === 2 ? (method === "wechat" ? "用微信扫一扫收银台二维码，确认付款。付款后请耐心等待，页面会自动更新。" : `使用 ${method === "usdt_bep20" ? "BEP20（BSC）" : "TRC20（TRON）"} 网络，按收银台完整地址和准确金额转账；链上确认后自动发卡。`) : chapter.note;
  return <Modal isOpen={open} onOpenChange={changeOpen}>
    <Button variant="ghost" className={compact ? styles.compactTrigger : styles.featureTrigger} aria-label="观看购买流程演示">
      <span className={styles.triggerPlay}><PlayIcon /></span>
      <span className={styles.triggerText}>{!compact && <small>第一次购买？跟着演示走一遍</small>}<strong>{compact ? compactLabel : <>了解完整<mark className={styles.marker}>购买流程</mark></>}</strong>{!compact && <span>选商品 · 邮箱登录 · 付款 · 取卡密 · 按指引使用</span>}</span>
      {!compact && <span className={styles.triggerEnd}>观看演示 ↗</span>}
    </Button>
    <Modal.Backdrop>
      <Modal.Container size="full" placement="center" className={styles.container}>
        <Modal.Dialog className={styles.dialog}>
          <Modal.CloseTrigger aria-label={showRedemption ? "关闭卡密兑换演示" : "关闭购买流程演示"} />
          {showRedemption ? <RedemptionContent autoPlay={redemptionAutoPlay} onBack={backToPurchase} /> : <>
          <Modal.Header className={styles.header}><Modal.Heading className={styles.title}>购买流程演示</Modal.Heading><p>约 45 秒看懂自助购买。点击下方章节，可跳转查看。</p></Modal.Header>
          <Modal.Body className={styles.body}>
            <Scene step={active} method={method} progress={progress} continueRef={continueRef} onContinue={() => { setPlaying(false); setRedemptionAutoPlay(!window.matchMedia("(prefers-reduced-motion: reduce)").matches); setShowRedemption(true); }} />
            <div className={styles.caption} aria-live="polite" aria-atomic="true"><span className={styles.stepNumber}>0{active + 1}</span><div><h3>{chapter.title}</h3><p>{paymentNote}</p></div></div>
            <div className={styles.controls}>
              <button type="button" className={styles.playControl} onClick={() => { if (ended) { setElapsed(0); setPlaying(true); } else setPlaying(p => !p); }} aria-label={ended ? "重播演示" : playing ? "暂停演示" : "播放演示"}>{ended ? <span aria-hidden="true">↻</span> : <PlayIcon pause={playing} />}</button>
              <nav className={styles.chapters} aria-label="演示章节">{chapters.map((c, i) => <button type="button" key={c.label} onClick={() => setElapsed(c.start)} aria-current={active === i ? "step" : undefined} aria-label={`跳转到第 ${i + 1} 章：${c.label}`}><span className={styles.track}><span style={{ width: `${Math.max(0, Math.min(1, (elapsed-c.start)/(c.end-c.start))) * 100}%` }} /></span><span>{i + 1} {c.label}</span></button>)}</nav>
              <span className={styles.time}>{Math.floor(elapsed).toString().padStart(2, "0")} / 45 秒</span>
            </div>
            <div className={styles.bottomRow}><span className={styles.finePrint}>演示不会创建订单或发起付款。</span><div className={styles.methods} role="group" aria-label="切换付款方式演示">{(["wechat", "usdt_bep20", "usdt_trc20"] as Method[]).map(m => <button type="button" key={m} aria-pressed={method === m} onClick={() => { setMethod(m); setElapsed(chapters[2].start); }}><PaymentIcon method={m} /><span>{m === "wechat" ? "微信" : m === "usdt_bep20" ? "BEP20" : "TRC20"}</span></button>)}</div></div>
          </Modal.Body>
          </>}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>;
}
