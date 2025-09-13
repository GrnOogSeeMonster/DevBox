"use client";
import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">DevBox Studio</h1>
        <p className="text-zinc-400 mt-2">Create, edit, run, and preview projects with instant feedback.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/(studio)/wizard" className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-6 shadow-soft hover:shadow-md transition">
          <div className="text-lg">New Project</div>
          <div className="text-sm text-zinc-400">Open wizard to choose model and stack</div>
        </Link>
        <a href="#" className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-6 shadow-soft">
          Recent Projects
        </a>
        <a href="#" className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-6 shadow-soft">
          Examples
        </a>
      </div>
    </main>
  );
}
