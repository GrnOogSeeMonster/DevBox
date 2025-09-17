"use client";
import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold">DevBox Studio</h1>
          <p className="text-zinc-400 mt-2">Create, edit, run, and preview projects with instant feedback.</p>
        </div>
        <Link 
          href="/config" 
          className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuration
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/wizard" className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-6 shadow-soft hover:shadow-md transition">
          <div className="text-lg font-medium mb-1">✨ New Project</div>
          <div className="text-sm text-zinc-400">Open wizard to choose model and stack</div>
        </Link>
        <a href="#" className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-6 shadow-soft opacity-60 cursor-not-allowed">
          <div className="text-lg font-medium mb-1">📁 Recent Projects</div>
          <div className="text-sm text-zinc-400">Coming soon</div>
        </a>
        <a href="#" className="rounded-xl bg-zinc-900/70 border border-zinc-800 p-6 shadow-soft opacity-60 cursor-not-allowed">
          <div className="text-lg font-medium mb-1">📚 Examples</div>
          <div className="text-sm text-zinc-400">Coming soon</div>
        </a>
      </div>
    </main>
  );
}
