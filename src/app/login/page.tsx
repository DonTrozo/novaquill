"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/track";
import { authReturnPath } from "@/lib/authReturn";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email already has an account. Google sign-in will now link to the existing account. Try Continue with Google again.",
  OAuthSignin: "Google sign-in could not start. Try again.",
  OAuthCallback: "Google returned to NovaQuill, but the callback failed. Try again.",
  OAuthCreateAccount: "Google sign-in returned successfully, but NovaQuill could not create the account.",
  AccessDenied: "Google sign-in was denied or cancelled.",
  Configuration: "Google sign-in is not configured correctly on the server.",
  Verification: "The sign-in link expired or has already been used.",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const oauthError = params.get("error");
  const callbackUrl = authReturnPath(next);
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) {
      setError("Invalid credentials");
      return;
    }
    track("signup_login");
    router.push(callbackUrl);
  }

  if (status === "authenticated") {
    return <div>Redirecting...</div>;
  }

  const oauthErrorMessage = oauthError ? OAUTH_ERROR_MESSAGES[oauthError] || "Google sign-in failed. Try again." : null;

  return (
    <div className="max-w-sm mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">{callbackUrl === "/sign" ? "Sign in to download" : "Log in"}</h1>
      {callbackUrl === "/sign" && <p className="mb-4 text-sm text-foreground/70">Your completed document is saved in this browser and will be ready after sign-in.</p>}
      <form onSubmit={onSubmit} className="grid gap-4">
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
          required
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white">Log in</button>
      </form>
      <div className="mt-4 grid gap-2">
        {oauthErrorMessage && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{oauthErrorMessage}</div>}
        <button onClick={() => signIn("google", { callbackUrl })} className="rounded-md px-4 py-2 border border-foreground/20">Continue with Google</button>
        <button onClick={() => signIn("apple", { callbackUrl })} className="rounded-md px-4 py-2 border border-foreground/20">Continue with Apple</button>
      </div>
      <div className="mt-4 text-sm">
        No account? <a className="underline" href={`/register?next=${encodeURIComponent(callbackUrl)}`}>Register</a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="max-w-sm mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-6">Log in</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-foreground/10 rounded-md"></div>
          <div className="h-10 bg-foreground/10 rounded-md"></div>
          <div className="h-10 bg-foreground/10 rounded-md"></div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
