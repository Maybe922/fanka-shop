export function PaymentIcon({ method }: { method: "wechat" | "usdt_bep20" | "usdt_trc20" }) {
  if (method === "wechat") return <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 shrink-0 text-[#07b657]"><path fill="currentColor" d="M13 4C6.9 4 2 8 2 13c0 2.8 1.6 5.3 4.2 7l-.9 3.4 3.8-1.9c1.2.4 2.5.6 3.9.6h.4a8.6 8.6 0 0 1-1.4-4.7c0-5.1 4.9-9.2 10.9-9.2C21 5.6 17.3 4 13 4Z"/><path fill="currentColor" d="M30 17.7c0-4.2-3.9-7.5-8.7-7.5s-8.7 3.3-8.7 7.5 3.9 7.5 8.7 7.5c1.1 0 2.1-.2 3.1-.5l3 1.5-.7-2.8c2-1.4 3.3-3.4 3.3-5.7Z"/><g fill="white"><circle cx="9" cy="11" r="1.3"/><circle cx="17" cy="11" r="1.3"/><circle cx="18" cy="16" r="1.1"/><circle cx="24" cy="16" r="1.1"/></g></svg>;
  const tron = method === "usdt_trc20";
  return <span aria-hidden="true" className="relative h-7 w-7 shrink-0">
    <svg viewBox="0 0 32 32" className="h-full w-full"><circle cx="16" cy="16" r="16" fill="#26a17b"/><path fill="white" d="M7 7h18v4h-7v3c5 .2 8 1 8 2s-3 1.8-8 2v7h-4v-7c-5-.2-8-1-8-2s3-1.8 8-2v-3H7Zm7 8c-3.6.2-6 .6-6 1s3.6 1 8 1 8-.6 8-1-2.4-.8-6-1v1h-4Z"/></svg>
    <span className={`absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-surface ${tron ? "bg-[#ef0027]" : "bg-[#f3ba2f]"}`}>
      {tron ? <svg viewBox="0 0 20 20" className="h-2.5 w-2.5"><path d="m3 3 14 3-6 12Zm0 0 8 6 6-3M11 9v9" fill="none" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/></svg> : <svg viewBox="0 0 20 20" className="h-2.5 w-2.5" fill="white"><path d="m10 1 4 4-2 2-2-2-2 2-2-2Zm-6 6 3 3-3 3-3-3Zm12 0 3 3-3 3-3-3ZM10 7l3 3-3 3-3-3Zm-2 6 2 2 2-2 2 2-4 4-4-4Z"/></svg>}
    </span>
  </span>;
}
