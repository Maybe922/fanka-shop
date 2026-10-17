"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import shared from "./purchase-demo.module.css";
import styles from "./redemption-demo.module.css";

const chapters = [
  { label: "登录账号", start: 0, end: 8, title: "先在同一个浏览器登录 ChatGPT", note: "打开 chatgpt.com，登录你要充值的账号。后面获取登录信息时，请使用同一浏览器、同一用户配置，不要切换到无痕窗口。" },
  { label: "验证卡密", start: 8, end: 17, title: "打开充值站，验证你的卡密", note: "进入 hongyunai.pro，选择「ChatGPT 信用卡充值」。粘贴从订单页复制的完整卡密，点击「验证卡密并继续」。其他类型卡密请按交付说明选择对应通道。" },
  { label: "填写信息", start: 17, end: 31, title: "复制 Session 内容，粘贴到登录信息框", note: "在已登录 ChatGPT 的浏览器中打开本段末尾的链接，全选并复制页面内容，再回到充值站的「ChatGPT 登录信息」框粘贴，点击「验证账号并继续」。若内容为空，先确认登录状态。" },
  { label: "核对邮箱", start: 31, end: 41, title: "确认是要充值的邮箱，再开始充值", note: "仔细核对充值站识别出的 ChatGPT 邮箱、套餐与订阅信息。它可能与购买卡密时的邮箱不同；确认无误后再点击「开始充值」。不一致时先返回更正。" },
  { label: "查看结果", start: 41, end: 50, title: "耐心等待，并查看充值结果", note: "提交后查看页面处理结果。完成后回到 ChatGPT 刷新并检查订阅状态；若未完成或报错，先查询订单，保留订单号联系客服，避免反复提交。" },
];
const TOTAL = 50;
const SESSION_URL = "https://chatgpt.com/api/auth/session";

function Note({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return <>{text.split(/(chatgpt\.com|hongyunai\.pro)/).map((part, index) =>
    part === "chatgpt.com" || part === "hongyunai.pro"
      ? <a key={index} href={`https://${part}/`} target="_blank" rel="noopener noreferrer" className={`${styles.external} underline decoration-current/40 underline-offset-4 hover:decoration-current`} aria-label={`打开 ${part}（新标签页）`} onClick={onNavigate}>{part}</a>
      : part
  )}</>;
}

function Play({ pause = false }: { pause?: boolean }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{pause ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m8 4 12 8-12 8z" />}</svg>;
}
function Action({ children }: { children: React.ReactNode }) {
  return <div className={styles.action}>{children}<span>→</span></div>;
}
function Scene({ step }: { step: number }) {
  return <div className={styles.frame} aria-label={`兑换演示画面：${chapters[step].label}`}>
    <div className={styles.bar}><strong>{step === 0 ? "ChatGPT" : "HongyunAI"}</strong><span>{step === 0 ? "chatgpt.com" : "hongyunai.pro"}</span><small>操作示意 · 虚构数据</small></div>
    <div className={styles.scene} key={step}>
      {step === 0 ? <div className={styles.login}>
        <div className={styles.symbol}>↗</div><h3>登录你要充值的 ChatGPT 账号</h3><p>在当前浏览器中打开</p><div className={styles.url}>https://chatgpt.com/</div><div className={styles.account}><span>示例账号</span><strong>buyer@example.com</strong></div><div className={styles.tip}>保持登录，再在同一浏览器打开充值站。</div>
      </div> : <div className={styles.layout}>
        <aside className={styles.aside}><span className={styles.eyebrow}>当前选择</span><h3>ChatGPT<br />信用卡充值</h3><p>验证卡密 → 确认账号 → 充值结果</p><div className={styles.asideNote}>请按订单交付说明<br />选择对应的充值通道</div></aside>
        <div className={styles.panel}>
          <div className={styles.steps}>{["验证卡密", "确认账号", "充值结果"].map((name, i) => <span key={name} className={(step === 1 ? 0 : step < 4 ? 1 : 2) === i ? styles.active : undefined}><b>{i + 1}</b>{name}</span>)}</div>
          {step === 1 && <><h3>验证信用卡充值卡密</h3><div className={styles.field}><span>ChatGPT 信用卡充值卡密</span><code>DEMO-XXXX-XXXX</code></div><p className={styles.hint}>从「我的订单」复制完整卡密，避免遗漏字符。</p><Action>验证卡密并继续</Action></>}
          {step === 2 && <><h3>校验 ChatGPT 账号</h3><div className={styles.sessionUrl}>打开：chatgpt.com/api/auth/session</div><div className={styles.sessionBox}><span>ChatGPT 登录信息</span><pre>{'{\n  "user": { "email": "buyer@example.com" },\n  "accessToken": "[虚构示例，不可使用]",\n  "expires": "[示例有效期]"\n}'}</pre></div><Action>验证账号并继续</Action></>}
          {step === 3 && <><h3>确认充值账号</h3><div className={styles.email}><span>请重点核对 ChatGPT 邮箱</span><strong>buyer@example.com</strong><small>不是目标邮箱？返回上一步，检查登录账号。</small></div><div className={styles.summary}><span>充值套餐</span><strong>以卡密识别结果为准</strong></div><Action>开始充值</Action></>}
          {step === 4 && <><div className={styles.waitIcon}>◷</div><h3>充值处理中，请耐心等待</h3><p className={styles.result}>以充值站显示的实际结果为准<br />处理时间受通道与账号状态影响</p><div className={styles.resultSteps}><span>① 查看充值结果 / 查询订单</span><span>② 回到 ChatGPT 检查订阅</span><span>③ 异常时保留订单号联系客服</span></div></>}
        </div>
      </div>}
    </div>
  </div>;
}

export function RedemptionContent({ autoPlay, onBack }: { autoPlay: boolean; onBack?: () => void }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (onBack) backRef.current?.focus(); }, [onBack]);
  const [playing, setPlaying] = useState(autoPlay);
  const [elapsed, setElapsed] = useState(0);
  const ended = elapsed >= TOTAL;
  const active = Math.max(0, chapters.findLastIndex(c => elapsed >= c.start));
  const chapter = chapters[active];
  useEffect(() => {
    if (!playing || ended) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.5);
      setElapsed(value => Math.min(TOTAL, value + delta));
      previous = now;
    }, 100);
    return () => clearInterval(timer);
  }, [playing, ended]);
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  return <>
      <Modal.Header className={shared.header}>{onBack && <button ref={backRef} type="button" className={shared.backToPurchase} onClick={onBack}>← 返回购买流程</button>}<Modal.Heading className={shared.title}>卡密兑换演示</Modal.Heading><p>HongyunAI · ChatGPT 信用卡充值。约 50 秒，可点击章节跳转。</p></Modal.Header>
      <Modal.Body className={shared.body}>
        <Scene step={active} />
        <div className={`${shared.caption} ${styles.caption}`} aria-live="polite" aria-atomic="true"><span className={shared.stepNumber}>0{active + 1}</span><div><h3>{chapter.title}</h3><p><Note text={chapter.note} onNavigate={() => setPlaying(false)} />{active === 2 && <> <a href={SESSION_URL} target="_blank" rel="noopener noreferrer" className={`${styles.external} break-all underline decoration-current/40 underline-offset-4 hover:decoration-current`} aria-label="打开 ChatGPT Session 页面（新标签页）" onClick={() => setPlaying(false)}>{SESSION_URL} ↗</a></>}</p></div></div>
        <div className={shared.controls}>
          <button type="button" className={shared.playControl} aria-label={ended ? "重播兑换演示" : playing ? "暂停兑换演示" : "播放兑换演示"} onClick={() => { if (ended) { setElapsed(0); setPlaying(true); } else setPlaying(v => !v); }}>{ended ? "↻" : <Play pause={playing} />}</button>
          <nav className={shared.chapters} aria-label="兑换演示章节">{chapters.map((c, i) => <button type="button" key={c.label} onClick={() => setElapsed(c.start)} aria-current={active === i ? "step" : undefined} aria-label={`跳转到兑换第 ${i + 1} 章：${c.label}`}><span className={shared.track}><span style={{ width: `${Math.max(0, Math.min(1, (elapsed-c.start)/(c.end-c.start))) * 100}%` }} /></span><span>{i + 1} {c.label}</span></button>)}</nav>
          <span className={shared.time}>{Math.floor(elapsed).toString().padStart(2, "0")} / 50 秒</span>
        </div>
        <div className={shared.bottomRow}><span className={shared.finePrint}>仅作流程示意，不会消耗卡密或发起充值；实际界面以充值站为准。</span><a className={styles.external} href="https://hongyunai.pro/" target="_blank" rel="noopener noreferrer">前往充值站 ↗</a></div>
      </Modal.Body>
  </>;
}

export function RedemptionDemo({ featured = false }: { featured?: boolean }) {
  const [open, setOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  function changeOpen(value: boolean) {
    setOpen(value);
    setAutoPlay(value && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  return <Modal isOpen={open} onOpenChange={changeOpen}>
    <Button variant="ghost" className={featured ? shared.featureTrigger : shared.compactTrigger} aria-label="观看卡密兑换演示">
      <span className={shared.triggerPlay}><Play /></span>
      <span className={shared.triggerText}>
        {featured && <small>已经拿到卡密？跟着演示完成兑换</small>}
        <strong>{featured ? <>了解卡密<mark className={shared.marker}>兑换流程</mark></> : "卡密兑换演示"}</strong>
        {featured && <span>登录账号 · 验证卡密 · 填写信息 · 核对邮箱 · 查看结果</span>}
      </span>
      {featured && <span className={shared.triggerEnd}>观看演示 ↗</span>}
    </Button>
    <Modal.Backdrop><Modal.Container size="full" placement="center" className={shared.container}><Modal.Dialog className={shared.dialog}>
      <Modal.CloseTrigger aria-label="关闭卡密兑换演示" />
      {open && <RedemptionContent autoPlay={autoPlay} />}
    </Modal.Dialog></Modal.Container></Modal.Backdrop>
  </Modal>;
}
