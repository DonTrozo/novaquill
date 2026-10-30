import { createHash } from "crypto";

// PayFast REST API signatures differ from checkout signatures: passphrase is sorted too.
export function payfastApiSignature(headers: Record<string, string>, passphrase: string) {
  const values = { ...headers, passphrase };
  const encoded = Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+").replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`).join("&");
  return createHash("md5").update(encoded).digest("hex");
}

export async function cancelPayfastSubscription(token: string) {
  const merchant = process.env.PAYFAST_MERCHANT_ID;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchant || !passphrase || !/^[A-Za-z0-9-]{8,128}$/.test(token)) throw new Error("Billing cancellation unavailable");
  const headers = { "merchant-id": merchant, version: "v1", timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00") };
  const url = new URL(`https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/cancel`);
  if (process.env.PAYFAST_ENV !== "live") url.searchParams.set("testing", "true");
  const signedHeaders = { ...headers, signature: payfastApiSignature(headers, passphrase) };
  try {
    const response = await fetch(url, { method: "PUT", headers: signedHeaders, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const result = await response.json() as { status?: string; data?: { response?: unknown } };
    if (response.ok && result.status === "success" && result.data?.response === true) return;
  } catch { /* Reconcile an uncertain result before reporting failure. */ }
  // A previous attempt may have reached PayFast even if the connection/database failed.
  const checkUrl = new URL(url); checkUrl.pathname = checkUrl.pathname.replace(/\/cancel$/, "/fetch");
  try {
    const check = await fetch(checkUrl, { headers: signedHeaders, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
    const result = await check.json() as { status?: string; data?: { response?: { status_text?: string; token?: string } } };
    const subscription = result.data?.response;
    if (check.ok && result.status === "success" && subscription?.status_text === "CANCELLED" && (!subscription.token || subscription.token === token)) return;
  } catch { /* Never infer cancellation from an unavailable provider. */ }
  throw new Error("Provider did not confirm cancellation");
}
