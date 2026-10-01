export const FREE_DOCUMENT_LIMIT = 3;

export type QuotaUser = {
  subscription: "FREE" | "PRO";
  usageYearMonth: number | null;
  docsUsedThisMonth: number;
};

export function usageMonth(date = new Date()) {
  return date.getUTCFullYear() * 100 + date.getUTCMonth() + 1;
}

export function remainingDocuments(user: QuotaUser, month: number) {
  if (user.subscription === "PRO") return null;
  const used = user.usageYearMonth === month ? user.docsUsedThisMonth : 0;
  return Math.max(0, FREE_DOCUMENT_LIMIT - used);
}

// Optimistic compare-and-set prevents simultaneous tabs from spending the same
// final free credit. Retrying reads the winner's updated counter.
export async function reserveDocumentCredit(store: {
  read: () => Promise<QuotaUser | null>;
  compareAndSet: (previous: QuotaUser, month: number, used: number) => Promise<boolean>;
}, month = usageMonth()) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const user = await store.read();
    if (!user) return { status: 404, error: "Account not found" };
    const remaining = remainingDocuments(user, month);
    if (remaining === 0) return { status: 402, error: "Your 3 free documents for this month have been used. Upgrade to Pro for unlimited signing." };
    const used = (user.usageYearMonth === month ? user.docsUsedThisMonth : 0) + 1;
    if (await store.compareAndSet(user, month, used)) return { status: 200, used, remaining: remaining === null ? null : remaining - 1 };
  }
  return { status: 409, error: "Another document is being completed. Please try again." };
}
