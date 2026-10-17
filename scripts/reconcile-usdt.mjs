// Every minute under flock. No wallet private key or exchange withdrawal permission required.
const secret = process.env.USDT_RECONCILE_SECRET;
if (!secret) throw new Error('USDT reconciliation is not configured');
const res = await fetch('http://127.0.0.1:3000/api/internal/payments/usdt/reconcile', {
  method: 'POST', headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(70000),
});
if (!res.ok) throw new Error(`USDT reconciliation failed (${res.status})`);
const result = await res.json();
if (result.settled || result.needsReview) console.log(new Date().toISOString(), result);
