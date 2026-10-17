import { createHash } from "node:crypto";

// Mainnet USD₮ contract published by Tether; TRC20 uses 6 decimal places.
export const TRON_TOKEN = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const TRON_CHAIN_ID = 728126428;
const GENESIS = "00000000000000001ebf88508a03865c71d452e25f4d51194196a1d22b6653dc";
const TRANSFER = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const HASH = /^[0-9a-f]{64}$/i;
const WORD = /^[0-9a-f]{64}$/i;
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export type TronBlock = { blockID: string; block_header: { raw_data: { number: number; timestamp: number } }; transactions?: { txID: string }[] };
export type TronLog = { address: string; topics: string[]; data: string };
export type TronReceipt = { id: string; blockNumber: number; blockTimeStamp: number; receipt: { result: string }; log?: TronLog[] };
export type TronApi = <T>(path: string, body?: Record<string, unknown>) => Promise<T>;
export type TronQuote = { recipient: string; amount_micros: number; start_block: number; created_at: string; expires_at: string };
export function tronHex(address: string): string {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) throw new Error("Invalid TRON address");
  let n = BigInt(0);
  for (const c of address) n = n * BigInt(58) + BigInt(ALPHABET.indexOf(c));
  const bytes = Buffer.from(n.toString(16).padStart(50, "0"), "hex");
  const payload = bytes.subarray(0, 21);
  const checksum = createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);
  if (bytes.length !== 25 || payload[0] !== 0x41 || !checksum.equals(bytes.subarray(21))) throw new Error("Invalid TRON checksum");
  return payload.toString("hex");
}
export function validTronAddress(address: string): boolean {
  try { tronHex(address); return true; } catch { return false; }
}
export function makeTronApi(key = "", fetcher: typeof fetch = fetch): TronApi {
  return async <T>(path: string, body?: Record<string, unknown>): Promise<T> => {
    if (!/^\/(wallet(?:solidity)?\/\w+|v1\/accounts\/T[1-9A-HJ-NP-Za-km-z]{33}\/transactions\/trc20(?:\?.*)?)$/.test(path)) throw new Error("Unsupported TRON endpoint");
    const response = await fetcher(`https://api.trongrid.io${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(key ? { "TRON-PRO-API-KEY": key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`TRON HTTP ${response.status}`);
    const data = await response.json();
    if (!data || data.Error || data.error || data.success === false) throw new Error("TRON API unavailable");
    return data as T;
  };
}
function blockData(block: TronBlock) {
  const data = block.block_header?.raw_data;
  if (!HASH.test(block.blockID) || !Number.isSafeInteger(data?.number) || data.number < 0 ||
      !Number.isSafeInteger(data.timestamp) || Number(BigInt(`0x${block.blockID.slice(0, 16)}`)) !== data.number) throw new Error("Invalid TRON block");
  return data;
}
export async function checkedTronHead(api: TronApi, now = Date.now()) {
  const genesis = await api<TronBlock>("/walletsolidity/getblockbynum", { num: 0 });
  if (genesis.blockID !== GENESIS) throw new Error("Wrong TRON network");
  const head = await api<TronBlock>("/walletsolidity/getnowblock", {});
  const data = blockData(head);
  if (now - data.timestamp > 180000 || data.timestamp > now + 30000) throw new Error("Stale TRON finalized head");
  return head;
}
export async function latestTronHeight(api: TronApi, now = Date.now()) {
  const data = blockData(await api<TronBlock>("/wallet/getnowblock", {}));
  if (now - data.timestamp > 90000 || data.timestamp > now + 30000) throw new Error("Stale TRON head");
  return data.number;
}
export function matchingTronLog(log: TronLog, recipient: string, micros: number) {
  if (!Number.isSafeInteger(micros) || micros <= 0) throw new Error("Invalid amount");
  return log.address?.toLowerCase() === tronHex(TRON_TOKEN).slice(2) && log.topics?.length === 3 &&
    log.topics[0]?.toLowerCase() === TRANSFER && WORD.test(log.topics[1]) &&
    log.topics[2]?.toLowerCase() === tronHex(recipient).slice(2).padStart(64, "0") &&
    log.topics[1].toLowerCase() !== log.topics[2].toLowerCase() &&
    WORD.test(log.data) && BigInt(`0x${log.data}`) === BigInt(micros);
}
export async function verifyTronTransfer(api: TronApi, tx: string, quote: TronQuote, finalizedHeight: number) {
  if (!HASH.test(tx)) throw new Error("Invalid TRON transaction");
  const receipt = await api<TronReceipt>("/walletsolidity/gettransactioninfobyid", { value: tx });
  if (receipt.id?.toLowerCase() !== tx.toLowerCase() || receipt.receipt?.result !== "SUCCESS" ||
      !Number.isSafeInteger(receipt.blockNumber) || receipt.blockNumber <= quote.start_block || receipt.blockNumber > finalizedHeight) throw new Error("Unconfirmed, failed or old TRON transfer");
  const block = await api<TronBlock>("/walletsolidity/getblockbynum", { num: receipt.blockNumber });
  const data = blockData(block);
  if (data.number !== receipt.blockNumber || data.timestamp !== receipt.blockTimeStamp ||
      data.timestamp < Date.parse(quote.created_at) || !block.transactions?.some(t => t.txID.toLowerCase() === tx.toLowerCase())) throw new Error("TRON receipt/block mismatch");
  const logIndex = receipt.log?.findIndex(log => matchingTronLog(log, quote.recipient, quote.amount_micros)) ?? -1;
  if (logIndex < 0) throw new Error("TRON transfer mismatch");
  return { txHash: `0x${tx.toLowerCase()}`, logIndex, blockNumber: data.number, blockHash: `0x${block.blockID.toLowerCase()}`, blockTime: new Date(data.timestamp).toISOString() };
}
// History is only candidate discovery. Every candidate is independently checked against a
// solidified successful receipt and its canonical block before it may settle an order.
export async function tronCandidates(api: TronApi, quote: TronQuote, now = Date.now()) {
  const params = new URLSearchParams({ only_confirmed: "true", only_to: "true", limit: "200", order_by: "block_timestamp,asc",
    contract_address: TRON_TOKEN, min_timestamp: String(Date.parse(quote.created_at)), max_timestamp: String(now) });
  const found = new Set<string>();
  const fingerprints = new Set<string>();
  for (let page = 0; page < 10; page++) {
    const result = await api<{ success: boolean; data: { transaction_id: string; to: string; type: string; value: string; token_info: { address: string; decimals: number } }[]; meta?: { fingerprint?: string; links?: { next?: string } } }>(`/v1/accounts/${quote.recipient}/transactions/trc20?${params}`);
    if (result.success !== true || !Array.isArray(result.data)) throw new Error("Incomplete TRON history");
    for (const t of result.data) if (t.type === "Transfer" && t.to === quote.recipient && t.token_info?.address === TRON_TOKEN &&
      t.token_info.decimals === 6 && t.value === String(quote.amount_micros) && HASH.test(t.transaction_id)) found.add(t.transaction_id);
    if (!result.meta?.links?.next) return [...found];
    const next = result.meta.fingerprint;
    if (!next || fingerprints.has(next)) throw new Error("Invalid TRON history pagination");
    fingerprints.add(next); params.set("fingerprint", next);
  }
  throw new Error("TRON history scan incomplete");
}
