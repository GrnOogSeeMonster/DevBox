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
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);

  const cta = useMemo(() => `Continue with ${labelOf(model)} + ${labelOfStack(stack)} →`, [model, stack]);

  function labelOf(k: string) { return MODELS.find(m => m.key === k)?.name ?? k; }
  function labelOfStack(k: string) { return STACKS.find(s => s.key === k)?.name ?? k; }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setValidatingKey(true);
    setProgress(["Validating API key..."]);
    
    // First validate the API key for the selected model
    try {
      const modelName = MODELS.find(m => m.key === model)?.name || "Gemini CLI";
      const validationRes = await fetch("/api/config/validate-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName })
      });
      
      const validation = await validationRes.json();
      if (!validation.valid) {
        setError(`API key validation failed: ${validation.message}. Please configure your API keys.`);
        setProgress([]);
        setValidatingKey(false);
        setSubmitting(false);
        
        // Redirect to config page after a delay
        setTimeout(() => {
          window.location.href = "/config";
        }, 2000);
        return;
      }
    } catch (e) {
      setError("Failed to validate API key. Please check your configuration.");
      setValidatingKey(false);
      setSubmitting(false);
      return;
    }
    
    setValidatingKey(false);
    setProgress(["Creating project…"]);
    
    try {
      const name = `${labelOfStack(stack)} App`;
      const payload = { name, model, stack, purpose };
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Project create failed: ${res.status}`);
      const project = await res.json();
      setProjectId(project.id);
      setProgress(p => [...p, "Creating sandbox…"]);
      const sres = await fetch(`/api/projects/${project.id}/sandboxes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stack }) });
      if (!sres.ok) {
        const text = await sres.text();
        throw new Error(`Sandbox create failed: ${sres.status} ${text}`);
      }
      const sandbox = await sres.json();
      setSandboxId(sandbox.id);
      setProgress(p => [...p, "Starting dev server…"]);
      // Tail session.log briefly for user feedback
      try {
        // Explicitly call our Next proxy at /api/projects/{id}/session-log
        const logUrl = `/api/projects/${project.id}/session-log`;
        for (let i=0; i<6; i++) { // ~12 seconds
          const t = await fetch(logUrl);
          if (t.ok) {
            const body = await t.text();
            const tail = body.trim().split('\n').slice(-6);
            setProgress(p => [...p, ...tail.map(l=> l.replace(/^\[.*?\]\s*/, ''))]);
          }
          await new Promise(r=> setTimeout(r, 2000));
        }
      } catch {}
      // Gate redirect until preview HEAD succeeds or we hit timeout
      try {
        // Prefer authoritative readiness from session.log
        const deadline = Date.now() + 180000; // allow extra for first install
        const logUrl = `/api/projects/${project.id}/session-log`;
        let ready = false;
        while (Date.now() < deadline) {
          try {
            const t = await fetch(logUrl);
            const body = t.ok ? await t.text() : '';
            if (body.includes(`ORCH:create_sandbox:ready`) && body.includes(sandbox.id)) { ready = true; break; }
          } catch {}
          await new Promise(r => setTimeout(r, 2000));
        }
        if (!ready) {
          const base = window.location.origin;
          const previewUrl = `${base}/api/preview/${sandbox.id}`;
          setProgress(p => [...p, `Dev server not confirmed ready after 180s.`]);
          setProgress(p => [...p, `Tried: ${previewUrl}`]);
          setError("Dev server did not become ready. See session log for details.");
          setSubmitting(false);
          return;
        }
      } catch {}
      window.location.href = `/studio/${project.id}?sid=${sandbox.id}`;
    } catch (e: any) {
      setError(e?.message || "Failed to start session");
      setSubmitting(false);
    }
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
          <div className="flex-1 flex items-center justify-center">
            {submitting && (
              <div className="flex items-center gap-1 text-zinc-300 select-none">
                <span className="shape bg-brand opacity-100" style={{animationDelay:'0ms'}} />
                <span className="shape bg-brand/90" style={{animationDelay:'200ms'}} />
                <span className="shape bg-brand/80" style={{animationDelay:'400ms'}} />
                <span className="shape bg-brand/70" style={{animationDelay:'600ms'}} />
                <span className="shape bg-brand/60" style={{animationDelay:'800ms'}} />
                <span className="shape bg-brand/50" style={{animationDelay:'1000ms'}} />
                <span className="shape bg-brand/40" style={{animationDelay:'1200ms'}} />
                <span className="shape bg-brand/30" style={{animationDelay:'1400ms'}} />
                <span className="shape bg-brand/20" style={{animationDelay:'1600ms'}} />
                <span className="shape bg-brand/10" style={{animationDelay:'1800ms'}} />
                <span className="shape bg-brand/5" style={{animationDelay:'2000ms'}} />
                <span className="shape bg-brand/0" style={{animationDelay:'2200ms'}} />
                <style jsx>{`
                  .shape { 
                    width: 8px; 
                    height: 8px; 
                    display: inline-block; 
                    animation: shape-morph 2.4s infinite ease-in-out;
                    border-radius: 9999px;
                    box-shadow: 0 0 8px rgba(34, 211, 238, 0.3);
                  }
                  @keyframes shape-morph {
                    0% { 
                      border-radius: 9999px; 
                      transform: translateY(0) scale(1);
                      opacity: 1;
                    }
                    25% { 
                      border-radius: 2px; 
                      transform: translateY(-3px) scale(1.1);
                      opacity: 0.8;
                    }
                    50% { 
                      border-radius: 2px; 
                      transform: translateY(0) scale(1);
                      opacity: 0.6;
                    }
                    75% { 
                      border-radius: 2px; 
                      transform: translateY(2px) scale(0.9);
                      opacity: 0.4;
                    }
                    100% { 
                      border-radius: 9999px; 
                      transform: translateY(0) scale(0.8);
                      opacity: 0.2;
                    }
                  }
                `}</style>
              </div>
            )}
          </div>
          <div className="space-x-2">
            {step>1 && <button onClick={()=>setStep(step-1)} className="px-4 py-2 rounded-lg border border-zinc-700">Back</button>}
            {step<3 ? (
              <button onClick={()=>setStep(step+1)} className="px-4 py-2 rounded-lg bg-brand text-black font-medium shadow-soft">Next</button>
            ) : (
              <button disabled={submitting} onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-brand text-black font-medium shadow-soft disabled:opacity-60">{submitting? 'Starting…' : cta}</button>
            )}
          </div>
        </div>

        {submitting && (
          <div className="mt-6 rounded-lg border border-zinc-800 bg-black/30 p-4 text-sm text-zinc-300 space-y-1">
            <div className="font-medium text-zinc-200 mb-1">Creating new terminal project…</div>
            {progress.map((p,i)=> (<div key={i}>• {p}</div>))}
            <div className="text-xs text-zinc-500 mt-2">This may take up to a minute on first run.</div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-red-400 text-sm space-y-2">
            <div>{error}</div>
            <div className="flex gap-2">
              {projectId && (
                <a
                  href={`/api/projects/${projectId}/session-log`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-200"
                >
                  View session log
                </a>
              )}
              {sandboxId && (
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/preview/${sandboxId}`)}
                  className="px-3 py-1 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-200"
                >
                  Copy preview URL
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
