import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildForm, buildSignature, getPayfastEndpoint } from "@/lib/payfast";
import { eurToZar } from "@/lib/fx";
import { prisma } from "@/lib/prisma";
import {
  amountToCents,
  centsToAmountString,
  createCheckoutReference,
  getSubscriptionPlanConfig,
  parseSubscriptionCheckoutPlan,
} from "@/lib/subscription";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ plan: string }> }
) {
  const { plan: rawPlan } = await params;
  const plan = parseSubscriptionCheckoutPlan(rawPlan);
  if (!plan) {
    return new Response("Invalid plan", { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const login = new URL(`/login`, base);
    login.searchParams.set("next", `/api/subscribe/${rawPlan}`);
    return Response.redirect(login.toString(), 302);
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return new Response("Unauthorized", { status: 401 });

  const env: "sandbox" | "live" = (process.env.PAYFAST_ENV as "sandbox" | "live") === "live" ? "live" : "sandbox";
  const merchant_id = process.env.PAYFAST_MERCHANT_ID || "";
  const merchant_key = process.env.PAYFAST_MERCHANT_KEY || "";
  const passphrase = process.env.PAYFAST_PASSPHRASE || undefined;

  const planConfig = getSubscriptionPlanConfig(plan);
  // EUR pricing, convert to ZAR for PayFast
  const amountZar = await eurToZar(planConfig.eurAmount);
  const amountCents = amountToCents(amountZar);
  const amount = centsToAmountString(amountCents);

  const return_url = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard`;
  const cancel_url = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/pricing`;
  const notify_url = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/payfast/itn`;

  // Used for reconciliation / ITN idempotency
  const m_payment_id = createCheckoutReference(user.id, planConfig.slug, amountCents);

  const paramsMap = {
    merchant_id,
    merchant_key,
    currency_code: "ZAR",
    return_url,
    cancel_url,
    notify_url,
    name_first: session.user.name || "",
    email_address: session.user.email || "",
    amount,
    item_name: planConfig.itemName,
    m_payment_id,
    // Custom fields to link ITN back to our user/plan
    custom_str1: user.id,
    custom_str2: planConfig.slug,
    custom_str3: planConfig.itemName,
    custom_str4: "ZAR",
    custom_int1: amountCents,
    // Recurring subscription
    subscription_type: 1,
    billing_date: new Date().toISOString().slice(0, 10),
    recurring_amount: amount,
    frequency: planConfig.frequency, // 6=annually, 3=monthly per PayFast
    cycles: 0, // 0 = indefinite
  } as const;

  const signature = buildSignature(paramsMap, passphrase);
  const action = getPayfastEndpoint(env);
  const html = buildForm({ ...paramsMap, signature }, action);
  return new Response(html, { 
    status: 200, 
    headers: { "Content-Type": "text/html; charset=utf-8" } 
  });
}


