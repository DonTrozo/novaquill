"use client";

import { signIn, useSession } from "next-auth/react";
import { Suspense, type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/track";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const { status } = useSession();

  if (status === "authenticated") {
    router.push(next || "/dashboard");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) {
      setError("Invalid credentials");
      return;
    }
    track("signup_login");
    router.push(next || "/dashboard");
  }

  if (status === "authenticated") {
    return <div>Redirecting...</div>;
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      <form onSubmit={onSubmit} className="grid gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
          required
        />
        <input
          type="password"
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
        <button onClick={() => signIn("google")} className="rounded-md px-4 py-2 border border-foreground/20">Continue with Google</button>
        <button onClick={() => signIn("apple")} className="rounded-md px-4 py-2 border border-foreground/20">Continue with Apple</button>
      </div>
      <div className="mt-4 text-sm">
        No account? <a className="underline" href="/register">Register</a>
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
