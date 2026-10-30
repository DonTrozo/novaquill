import { cancelPayfastSubscription } from "@/lib/payfastSubscriptions";
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { buildSignature, getPayfastEndpoint } from "@/lib/payfast";
import { prisma } from "@/lib/prisma";
import { encryptBuffer } from "@/lib/crypto";
import { paidPeriodEnd, paidThrough } from "@/lib/subscriptionAccess";
import { getSubscriptionPlanConfig, parseAmountToCents, parseCents, parseCheckoutReference, parseSubscriptionCheckoutPlan } from "@/lib/subscription";

export async function POST(req: NextRequest) {
  // Bound the streamed webhook, including requests without Content-Length.
  const reader = req.body?.getReader();
  if (!reader) return new Response("Invalid notification", { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 32_768) { await reader.cancel(); return new Response("Notification too large", { status: 413 }); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const values = new URLSearchParams(body);
  if ([...new Set(values.keys())].some((key) => values.getAll(key).length !== 1)) return new Response("Invalid notification", { status: 400 });
  const params = Object.fromEntries(values.entries());
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (!merchantId || !passphrase) return new Response("Payment notifications not configured", { status: 503 });
  const supplied = Buffer.from((params.signature || "").toLowerCase());
  const expected = Buffer.from(buildSignature(params, passphrase));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || params.merchant_id !== merchantId) return new Response("Invalid notification", { status: 400 });
  const status = (params.payment_status || "").toUpperCase();
  const completed = status === "COMPLETE" || status === "COMPLETE_PAYMENT";
  const cancelled = status === "CANCELLED";
  const failed = status === "FAILED";
  if (!completed && !cancelled && !failed) return NextResponse.json({ ok: true });
  // Confirm with PayFast itself before accepting a token, entitlement or cancellation.
  try {
    const endpoint = getPayfastEndpoint(process.env.PAYFAST_ENV === "live" ? "live" : "sandbox").replace(/\/process$/, "/query/validate");
    const validation = new URLSearchParams(values); validation.delete("signature");
    const check = await fetch(endpoint, { method: "POST", body: validation.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!check.ok || (await check.text()).trim() !== "VALID") return new Response("Invalid notification", { status: 400 });
  } catch { return new Response("Could not verify notification", { status: 503 }); }
  const reference = parseCheckoutReference(params.m_payment_id);
  const token = /^[A-Za-z0-9-]{8,128}$/.test(params.token || "") ? params.token : null;
  const tokenHash = token ? createHash("sha256").update(token).digest("hex") : null;
  const id = (params.custom_str1 || reference?.userId || "").trim();
  if (reference && id !== reference.userId) return new Response("Invalid account", { status: 400 });
  const plan = parseSubscriptionCheckoutPlan(params.custom_str2) ?? reference?.plan ?? null;
  if (reference && plan !== reference.plan) return new Response("Invalid plan", { status: 400 });
  if (completed) {
    if (!id || !plan) return new Response("Invalid purchase", { status: 400 });
    const config = getSubscriptionPlanConfig(plan);
    const currency = (params.currency_code || params.custom_str4 || (reference?.amountCents ? "ZAR" : "")).toUpperCase();
    const expectedAmount = parseCents(params.custom_int1) ?? reference?.amountCents;
    const amount = parseAmountToCents(params.amount_gross || params.amount);
    if (currency !== "ZAR" || params.item_name !== config.itemName || (params.custom_str3 && params.custom_str3 !== config.itemName) || !expectedAmount || amount !== expectedAmount || (params.recurring_amount && parseAmountToCents(params.recurring_amount) !== expectedAmount)) return new Response("Invalid amount or item", { status: 400 });
  }
  const paymentId = (params.pf_payment_id || params.m_payment_id || "").trim();
  if (!paymentId || paymentId.length > 256) return new Response("Invalid payment reference", { status: 400 });
  // Preserve existing COMPLETE event keys; a cancellation of that payment is a distinct event.
  const eventKey = completed ? paymentId : `${status}:${paymentId}:${tokenHash?.slice(0, 16) || ""}`;
  try {
    await prisma.$transaction(async (tx) => {
      const initial = id ? await tx.user.findUnique({ where: { id } }) : tokenHash ? await tx.user.findUnique({ where: { payfastSubscriptionIdHash: tokenHash } }) : null;
      if (!initial) {
        // A checkout can finish after account deletion. Stop that newly created mandate
        // and queue the verified charge for a human refund/entitlement review.
        if (!completed || !token || !id || (tokenHash && await tx.user.findUnique({ where: { payfastSubscriptionIdHash: tokenHash } }))) throw new Error("Account unavailable");
        await cancelPayfastSubscription(token);
        await tx.payfastEvent.create({ data: { pfPaymentId: eventKey, payload: { userId: id, paymentStatus: "REVIEW_AFTER_DELETION", plan, grossAmountCents: parseAmountToCents(params.amount_gross || params.amount), currency: "ZAR" } } });
        await tx.billingRequest.create({ data: { kind: "PAYMENT", encryptedContact: encryptBuffer(Buffer.from(params.email_address || "")), encryptedMessage: encryptBuffer(Buffer.from(JSON.stringify({ reason: "Verified payment after account deletion; mandate cancellation confirmed. Review refund and contact customer.", reference: paymentId, amount: params.amount_gross || params.amount, plan }))) } });
        return;
      }
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${initial.id} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: initial.id } });
      // Ignore notifications from an older replaced mandate without changing the new one.
      if (!completed && tokenHash && user.payfastSubscriptionIdHash && user.payfastSubscriptionIdHash !== tokenHash) return;
      await tx.payfastEvent.create({ data: { pfPaymentId: eventKey, payload: { userId: user.id, paymentStatus: status, plan, grossAmountCents: parseAmountToCents(params.amount_gross || params.amount), currency: "ZAR" } } });
      const now = new Date();
      if (completed && plan) {
        const config = getSubscriptionPlanConfig(plan);
        const nextEnd = paidPeriodEnd(now, config.dbPlan);
        const previousEnd = paidThrough(user);
        const end = previousEnd && previousEnd > nextEnd ? previousEnd : nextEnd;
        // A completed debit arriving after cancellation does not reactivate the same mandate.
        const sameMandate = tokenHash && tokenHash === user.payfastSubscriptionIdHash;
        await tx.user.update({ where: { id: user.id }, data: { subscription: "PRO", subscriptionPlan: config.dbPlan, lastPaymentAt: now, payfastLastPaymentId: paymentId, subscriptionPaidThroughAt: end, subscriptionCancelledAt: sameMandate ? user.subscriptionCancelledAt : null, ...(token ? { payfastSubscriptionToken: encryptBuffer(Buffer.from(token)), payfastSubscriptionIdHash: tokenHash } : {}) } });
        await tx.eventCounter.upsert({ where: { name: "upgrade_pro" }, update: { count: { increment: 1 } }, create: { name: "upgrade_pro", count: 1 } });
      } else {
        const end = paidThrough(user);
        await tx.user.update({ where: { id: user.id }, data: { subscriptionPaidThroughAt: end, ...(cancelled ? { subscriptionCancelledAt: user.subscriptionCancelledAt ?? now } : {}), payfastLastPaymentId: paymentId } });
        // A failure or cancellation never erases a period already paid for.
      }
    }, { timeout: 25_000 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002" && await prisma.payfastEvent.findUnique({ where: { pfPaymentId: eventKey }, select: { id: true } }).catch(() => null)) return NextResponse.json({ ok: true });
    return new Response("Could not record notification", { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
