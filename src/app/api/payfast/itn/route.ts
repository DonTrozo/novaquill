import { NextRequest, NextResponse } from "next/server";
import { buildSignature } from "@/lib/payfast";
import { prisma } from "@/lib/prisma";
import {
  getSubscriptionPlanConfig,
  parseAmountToCents,
  parseCents,
  parseCheckoutReference,
  parseSubscriptionCheckoutPlan,
} from "@/lib/subscription";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());

  // Verify signature
  const expected = buildSignature(params, process.env.PAYFAST_PASSPHRASE);
  if ((params.signature || "").toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const paymentStatus = (params.payment_status || "").trim().toUpperCase();
  const isCompleted = paymentStatus === "COMPLETE" || paymentStatus === "COMPLETE_PAYMENT";
  const isCancelled = paymentStatus === "CANCELLED" || paymentStatus === "FAILED";

  const checkoutReference = parseCheckoutReference(params.m_payment_id);
  const plan =
    parseSubscriptionCheckoutPlan(params.custom_str2) ??
    checkoutReference?.plan ??
    null;
  if (!plan) {
    return NextResponse.json({ ok: false, error: "invalid plan" }, { status: 400 });
  }
  const planConfig = getSubscriptionPlanConfig(plan);

  // Basic config validation (helps prevent accepting spoofed notifications).
  const expectedMerchantId = process.env.PAYFAST_MERCHANT_ID;
  if (expectedMerchantId && params.merchant_id !== expectedMerchantId) {
    return NextResponse.json({ ok: false, error: "merchant_id mismatch" }, { status: 400 });
  }
  const reportedCurrency = (params.currency_code || params.custom_str4 || "").trim().toUpperCase();
  if (reportedCurrency && reportedCurrency !== "ZAR") {
    return NextResponse.json({ ok: false, error: "currency mismatch" }, { status: 400 });
  }
  if (!reportedCurrency && isCompleted && !checkoutReference?.amountCents) {
    return NextResponse.json({ ok: false, error: "missing currency context" }, { status: 400 });
  }

  if (checkoutReference?.plan && checkoutReference.plan !== plan) {
    return NextResponse.json({ ok: false, error: "plan mismatch" }, { status: 400 });
  }

  const userIdFromCustom = (params.custom_str1 || "").trim();
  if (checkoutReference?.userId && userIdFromCustom && checkoutReference.userId !== userIdFromCustom) {
    return NextResponse.json({ ok: false, error: "user mismatch" }, { status: 400 });
  }

  const itemName = (params.item_name || "").trim();
  if (!itemName || itemName !== planConfig.itemName) {
    return NextResponse.json({ ok: false, error: "item mismatch" }, { status: 400 });
  }
  if (params.custom_str3 && params.custom_str3.trim() !== planConfig.itemName) {
    return NextResponse.json({ ok: false, error: "item metadata mismatch" }, { status: 400 });
  }

  const expectedAmountCents =
    parseCents(params.custom_int1) ??
    checkoutReference?.amountCents ??
    null;
  const grossAmountCents = parseAmountToCents(params.amount_gross || params.amount);
  if (isCompleted) {
    if (!expectedAmountCents || !grossAmountCents) {
      return NextResponse.json({ ok: false, error: "missing amount context" }, { status: 400 });
    }
    if (grossAmountCents !== expectedAmountCents) {
      return NextResponse.json({ ok: false, error: "amount mismatch" }, { status: 400 });
    }

    const recurringAmountCents = parseAmountToCents(params.recurring_amount);
    if (recurringAmountCents !== null && recurringAmountCents !== expectedAmountCents) {
      return NextResponse.json({ ok: false, error: "recurring amount mismatch" }, { status: 400 });
    }
  }

  // Idempotency / audit log (PayFast can retry ITNs)
  const pfPaymentId = (params.pf_payment_id || params.m_payment_id || "").trim();
  if (!pfPaymentId) {
    return NextResponse.json({ ok: false, error: "missing payment id" }, { status: 400 });
  }
  try {
    await prisma.payfastEvent.create({
      data: { pfPaymentId, payload: {
        userId: userIdFromCustom || checkoutReference?.userId || null,
        paymentStatus, plan, grossAmountCents, currency: "ZAR",
      } },
    });
  } catch {
    // Likely duplicate (unique constraint); treat as idempotent success
    return NextResponse.json({ ok: true });
  }

  // Status handling
  const userId = userIdFromCustom || checkoutReference?.userId || "";
  const email = (params.email_address || "").trim().toLowerCase();

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

  if (user) {
    if (isCompleted) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscription: "PRO",
          subscriptionPlan: planConfig.dbPlan,
          lastPaymentAt: new Date(),
          payfastLastPaymentId: pfPaymentId,
        },
      });
      await prisma.eventCounter.upsert({
        where: { name: "upgrade_pro" },
        update: { count: { increment: 1 } },
        create: { name: "upgrade_pro", count: 1 },
      });
    } else if (isCancelled) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscription: "FREE",
          subscriptionPlan: null,
          payfastLastPaymentId: pfPaymentId,
        },
      });
    }
  }
  return NextResponse.json({ ok: true });
}


