"use client";
import React, { useMemo, useState } from "react";

const MODELS = [
  { key: "claude", name: "Claude Code", desc: "Advanced coding assistant with deep codebase understanding and multi-file editing." },
  { key: "codex", name: "Codex (GPT-5)", desc: "State-of-the-art coding model with exceptional SWE performance." },
  { key: "gemini", name: "Gemini CLI", desc: "Open-source AI agent with 1M-token context and tools for Google Search grounding." },
];

const STACKS = [
  { key: "next", name: "Next.js", cat: "Modern Web", enabled: true },
  { key: "vite-react", name: "Vite + React", cat: "Modern Web", enabled: true },
  { key: "vite-vue", name: "Vite + Vue", cat: "Modern Web", enabled: true },
  { key: "sveltekit", name: "SvelteKit", cat: "Modern Web", enabled: true },
  { key: "astro", name: "Astro", cat: "Modern Web", enabled: false },
  { key: "nuxt", name: "Nuxt 3", cat: "Modern Web", enabled: false },
  { key: "node", name: "Node / Express", cat: "Backend", enabled: true },
  { key: "nestjs", name: "NestJS", cat: "Backend", enabled: true },
  { key: "fastapi", name: "FastAPI", cat: "Backend", enabled: true },
  { key: "django", name: "Django", cat: "Backend", enabled: true },
  { key: "static", name: "Vite Static / Vanilla TS", cat: "Static", enabled: true },
  { key: "blank", name: "Blank", cat: "Manual", enabled: true }
];

const PURPOSES = [
  { key: "modern-web", name: "Modern Web App" },
  { key: "backend", name: "Backend API" },
  { key: "game", name: "Game Dev" },
  { key: "traditional", name: "Traditional Web" },
  { key: "static", name: "Static Site" },
  { key: "manual", name: "Manual / Blank" },
];

export default function WizardClient({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(1);
  const [model, setModel] = useState("gemini");
  const [stack, setStack] = useState("next");
  const [purpose, setPurpose] = useState("modern-web");

  const cta = useMemo(() => `Continue with ${labelOf(model)} + ${labelOfStack(stack)} →`, [model, stack]);

  function labelOf(k: string) { return MODELS.find(m => m.key === k)?.name ?? k; }
  function labelOfStack(k: string) { return STACKS.find(s => s.key === k)?.name ?? k; }

  async function handleSubmit() {
    const name = `${labelOfStack(stack)} App`;
    const payload = { name, model, stack, purpose };
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) return alert("Failed to create project");
    const project = await res.json();
    const sres = await fetch(`/api/projects/${project.id}/sandboxes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stack }) });
    if (!sres.ok) return alert("Failed to create sandbox");
    const sandbox = await sres.json();
    window.location.href = `/studio/${project.id}?sid=${sandbox.id}`;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50">
      <div className="w-full max-w-4xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-soft p-6">
        <div className="text-zinc-300 text-sm mb-4">Step {step} of 3</div>
        {step === 1 && (
          <div>
            <h2 className="text-2xl mb-4">Select Model</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODELS.map(m => (
                <button key={m.key} onClick={() => setModel(m.key)} className={`text-left rounded-xl p-4 border ${model===m.key?'border-brand bg-brand/10':'border-zinc-800 hover:border-zinc-700'} transition`}>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-sm text-zinc-400 mt-1">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 className="text-2xl mb-4">Select Stack</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STACKS.filter(s=>s.cat==="Modern Web").map(s => (
                <button key={s.key} disabled={!s.enabled} onClick={() => setStack(s.key)} className={`text-left rounded-xl p-4 border ${stack===s.key?'border-brand bg-brand/10':'border-zinc-800 hover:border-zinc-700'} transition ${!s.enabled?'opacity-50 cursor-not-allowed':''}`}>
                  <div className="font-medium">{s.name}</div>
                  {!s.enabled && <div className="text-xs text-zinc-500 mt-1">Coming soon</div>}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 className="text-2xl mb-4">Select Purpose</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PURPOSES.map(p => (
                <button key={p.key} onClick={() => setPurpose(p.key)} className={`rounded-lg p-3 border ${purpose===p.key?'border-brand bg-brand/10':'border-zinc-800 hover:border-zinc-700'}`}>{p.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button className="text-zinc-400 hover:text-zinc-200" onClick={onClose}>Cancel</button>
          <div className="space-x-2">
            {step>1 && <button onClick={()=>setStep(step-1)} className="px-4 py-2 rounded-lg border border-zinc-700">Back</button>}
            {step<3 ? (
              <button onClick={()=>setStep(step+1)} className="px-4 py-2 rounded-lg bg-brand text-black font-medium shadow-soft">Next</button>
            ) : (
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-brand text-black font-medium shadow-soft">{cta}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
