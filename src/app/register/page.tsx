"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { track } from "@/lib/track";
import { authReturnPath } from "@/lib/authReturn";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Registration failed");
      return;
    }
    track("signup_register");
    const next = authReturnPath(new URLSearchParams(window.location.search).get("next"));
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Create account</h1>
      <form onSubmit={onSubmit} className="grid gap-4">
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-foreground/20 px-3 py-2"
        />
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
        <button className="rounded-md px-4 py-2 bg-[color:var(--color-accent)] text-white">Register</button>
      </form>
    </div>
  );
}
