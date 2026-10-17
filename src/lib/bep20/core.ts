// No secrets or framework dependencies: verification is shared with offline tests.
export const CHAIN_ID = 56;
export const USDT_TOKEN = "0x55d398326f99059ff775485246999027b3197955";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const WORD_RE = /^0x[0-9a-fA-F]{64}$/;
export type RpcLog = { address: string; topics: string[]; data: string; blockNumber: string; blockHash: string; transactionHash: string; logIndex: string; removed?: boolean };
export type RpcBlock = { number: string; hash: string; timestamp: string };
export type RpcReceipt = { status: string; transactionHash: string; blockNumber: string; blockHash: string; logs: RpcLog[] };
export type Rpc = <T>(method: string, params?: unknown[]) => Promise<T>;

export function hexNumber(value: string): number {
  if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error("Invalid RPC number");
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Unsafe RPC number");
  return n;
}
export function asHex(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid block number");
  return `0x${n.toString(16)}`;
}
export function amountText(micros: number): string {
  if (!Number.isSafeInteger(micros) || micros <= 0) throw new Error("Invalid payment amount");
  return `${Math.floor(micros / 1e6)}.${String(micros % 1e6).padStart(6, "0")}`;
}
export function atomicAmount(micros: number): string {
  amountText(micros);
  return (BigInt(micros) * BigInt("1000000000000")).toString();
}
export function recipientTopic(address: string): string {
  if (!ADDRESS_RE.test(address)) throw new Error("Invalid recipient");
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}
export function makeRpc(url: string, fetcher: typeof fetch = fetch): Rpc {
  if (new URL(url).protocol !== "https:") throw new Error("HTTPS RPC required");
  return async <T>(method: string, params: unknown[] = []): Promise<T> => {
    const res = await fetcher(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const data = await res.json();
    if (data.error || data.result == null) throw new Error(`RPC unavailable: ${method}`);
    return data.result as T;
  };
}
// Public log endpoints may restrict receipt/history reads. Fail over only these
// verification reads; never treat an unavailable provider as an empty scan.
export function withVerificationFallback(primary: Rpc, fallback: Rpc): Rpc {
  let verifiedNetwork = false;
  return async <T>(method: string, params: unknown[] = []): Promise<T> => {
    try { return await primary<T>(method, params); }
    catch (error) {
      if (method !== "eth_getTransactionReceipt" &&
          !(method === "eth_getBlockByNumber" && /^0x[0-9a-f]+$/i.test(String(params[0])))) throw error;
      if (!verifiedNetwork) {
        if (hexNumber(await fallback<string>("eth_chainId")) !== CHAIN_ID) throw new Error("Wrong fallback network");
        verifiedNetwork = true;
      }
      return fallback<T>(method, params);
    }
  };
}
export async function checkedHead(rpc: Rpc, now = Date.now()): Promise<RpcBlock> {
  const chain = await rpc<string>("eth_chainId");
  if (hexNumber(chain) !== CHAIN_ID) throw new Error("Wrong network");
  const head = await rpc<RpcBlock>("eth_getBlockByNumber", ["finalized", false]);
  const time = hexNumber(head.timestamp) * 1000;
  if (!HASH_RE.test(head.hash) || now - time > 120000 || time - now > 30000) throw new Error("Finalized head is stale");
  hexNumber(head.number);
  return head;
}
export async function getLiveRate(fetcher: typeof fetch = fetch, now = Date.now()): Promise<{ rate: string; fetchedAt: string }> {
  const res = await fetcher("https://api.coinbase.com/v2/exchange-rates?currency=USDT", {
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Rate unavailable");
  const value = await res.json();
  const rate = value.data?.rates?.CNY;
  // Reject cache/proxy replay; never silently substitute 1 USDT = 1 USD or a fixed rate.
  const date = Date.parse(res.headers.get("date") ?? "");
  if (!Number.isFinite(date) || Math.abs(now - date) > 90000 || value.data?.currency !== "USDT" ||
      typeof rate !== "string" || !/^\d+(\.\d{1,10})?$/.test(rate) || Number(rate) < 1 || Number(rate) > 100) {
    throw new Error("Invalid or stale exchange rate");
  }
  return { rate, fetchedAt: new Date(now).toISOString() };
}
export function matchingTransfer(log: RpcLog, recipient: string, micros: number): boolean {
  return !log.removed && log.address?.toLowerCase() === USDT_TOKEN &&
    log.topics?.length === 3 && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
    WORD_RE.test(log.topics[1]) && log.topics[2]?.toLowerCase() === recipientTopic(recipient) &&
    log.topics[1].toLowerCase() !== log.topics[2].toLowerCase() &&
    WORD_RE.test(log.data) && BigInt(log.data).toString() === atomicAmount(micros);
}
export async function verifyTransfer(rpc: Rpc, log: RpcLog, quote: {
  recipient: string; amount_micros: number; start_block: number; created_at: string;
}, finalizedHeight: number) {
  if (!matchingTransfer(log, quote.recipient, quote.amount_micros)) throw new Error("Wrong transfer");
  const height = hexNumber(log.blockNumber);
  const logIndex = hexNumber(log.logIndex);
  if (height <= quote.start_block || height > finalizedHeight || !HASH_RE.test(log.transactionHash) || !HASH_RE.test(log.blockHash)) throw new Error("Unconfirmed or old transfer");
  const receipt = await rpc<RpcReceipt>("eth_getTransactionReceipt", [log.transactionHash]);
  const block = await rpc<RpcBlock>("eth_getBlockByNumber", [log.blockNumber, false]);
  if (receipt.status !== "0x1" || receipt.transactionHash.toLowerCase() !== log.transactionHash.toLowerCase() ||
      receipt.blockHash.toLowerCase() !== log.blockHash.toLowerCase() || block.hash.toLowerCase() !== log.blockHash.toLowerCase() ||
      hexNumber(receipt.blockNumber) !== height || hexNumber(block.number) !== height ||
      !receipt.logs.some(item => item.logIndex === log.logIndex && item.transactionHash.toLowerCase() === log.transactionHash.toLowerCase() &&
        item.blockHash.toLowerCase() === log.blockHash.toLowerCase() && hexNumber(item.blockNumber) === height && matchingTransfer(item, quote.recipient, quote.amount_micros))) {
    throw new Error("Receipt verification failed");
  }
  const blockMs = hexNumber(block.timestamp) * 1000;
  if (blockMs < Math.floor(Date.parse(quote.created_at) / 1000) * 1000) throw new Error("Payment predates order");
  return {
    txHash: log.transactionHash.toLowerCase(), logIndex, blockNumber: height,
    blockHash: block.hash.toLowerCase(), blockTime: new Date(blockMs).toISOString(),
  };
}
