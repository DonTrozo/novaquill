"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="max-w-5xl mx-auto px-4 py-3 sm:px-6 sm:py-5 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[color:var(--color-accent)] rounded-lg flex items-center justify-center text-white font-bold text-lg">
          N
        </div>
        <span className="text-xl font-semibold">NovaQuill</span>
      </Link>
      <details className="relative z-50">
        <summary className="cursor-pointer rounded-md border border-foreground/15 px-3 py-2 text-sm">Menu</summary>
        <nav className="absolute right-0 mt-2 grid min-w-36 gap-1 rounded-lg border border-foreground/15 bg-background p-2 shadow-lg">
          <Link className="rounded px-3 py-2 text-sm hover:bg-foreground/5" href="/pricing">Pricing</Link>
          <Link className="rounded px-3 py-2 text-sm hover:bg-foreground/5" href="/dashboard">Dashboard</Link>
        </nav>
      </details>
    </header>
  );
}


