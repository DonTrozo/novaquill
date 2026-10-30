type SubscriptionAccount = {
  subscription: string;
  subscriptionPlan?: string | null;
  lastPaymentAt?: Date | string | null;
  subscriptionPaidThroughAt?: Date | string | null;
  subscriptionCancelledAt?: Date | string | null;
};

// Calendar periods, clamped to the final day (31 January -> 28/29 February).
export function paidPeriodEnd(start: Date, plan: string) {
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + (plan === "ANNUAL" ? 12 : 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}

export function paidThrough(account: SubscriptionAccount): Date | null {
  if (account.subscriptionPaidThroughAt) return new Date(account.subscriptionPaidThroughAt);
  if (account.lastPaymentAt && account.subscriptionPlan) return paidPeriodEnd(new Date(account.lastPaymentAt), account.subscriptionPlan);
  return null;
}

export function hasProAccess(account: SubscriptionAccount, now = new Date()) {
  const end = paidThrough(account);
  // Preserve untracked legacy entitlements until reconciled; never invent an expiry.
  if (!end) return account.subscription === "PRO";
  return end > now;
}
