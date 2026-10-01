export type SigningUsage = { subscription: "FREE" | "PRO" | "ANON"; used: number; limit: number | null };

export async function getSigningUsage(): Promise<SigningUsage> {
  const response = await fetch("/api/usage", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not check your document allowance. Please try again.");
  return response.json();
}

export async function checkSigningAllowance(): Promise<void> {
  const usage = await getSigningUsage();
  if (usage.subscription === "ANON") throw new Error("Please sign in before signing a document.");
  if (usage.limit !== null && usage.used >= usage.limit) {
    throw new Error("Your 3 free documents for this month have been used. Upgrade to Pro for unlimited signing.");
  }
}
