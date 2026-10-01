"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getSigningUsage, type SigningUsage } from "@/lib/signingAllowance";

export function useSigningUsage() {
  const { status } = useSession();
  const [usage, setUsage] = useState<SigningUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    setChecking(true);
    setError(null);
    try { setUsage(await getSigningUsage()); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not check your allowance."); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    if (status !== "authenticated") return;
    void refresh();
    const changed = () => { void refresh(); };
    window.addEventListener("novaquill:usage-changed", changed);
    return () => window.removeEventListener("novaquill:usage-changed", changed);
  }, [status, refresh]);
  return { usage, error, checking, refresh, status };
}

export function SigningUsageNotice({ state }: { state: ReturnType<typeof useSigningUsage> }) {
  const { usage, error, checking, refresh, status } = state;
  if (status !== "authenticated") return null;
  const remaining = usage?.limit == null ? null : Math.max(0, usage.limit - usage.used);
  return <div className="rounded-md border border-foreground/15 p-3 text-sm" role="status">
    {checking ? "Checking your document allowance…" : error ? <>
      {error} <button type="button" onClick={() => void refresh()} className="underline">Retry</button>
    </> : usage?.subscription === "PRO" ? "Pro · Unlimited signing" : <>
      {remaining} of {usage?.limit} free documents remaining this month. Previews do not use credits. {" "}
      <Link href="/pricing" className="font-medium underline">Upgrade to Pro</Link>
    </>}
  </div>;
}

export default function SigningAllowanceNotice() {
  const state = useSigningUsage();
  return <SigningUsageNotice state={state} />;
}
