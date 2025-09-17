"use client";
import React, { useEffect, useRef, useState } from "react";
import AgentBootstrap from "./AgentBootstrap";

export default function AgentPane({ sandboxId, projectId }: { sandboxId: string; projectId?: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [showBootstrap, setShowBootstrap] = useState(true);

  useEffect(() => {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://orchestrator.devbox.local/agent/${sandboxId}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setFallback(true);
      return;
    }
    wsRef.current = ws;
    ws.onmessage = (ev) => setLines((prev) => [...prev, String(ev.data)]);
    ws.onerror = () => { setLines((prev) => [...prev, `[ws error] ${url}`]); setFallback(true); };
    return () => ws.close();
  }, [sandboxId]);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);

  function send() {
    const msg = input.trim();
    if (!msg) return;
    setLines((prev)=>[...prev, `> ${msg}`]);
    if (!fallback) {
      try { wsRef.current?.send(msg); } catch { setFallback(true); }
    } else {
      // Fallback to HTTP echo via web proxy (avoids cross-origin)
      // Try both route variants for safety
      const endpoint = `/web/agent/${sandboxId}/echo`;
      const alt = `/api/agent/${sandboxId}/echo`;
      fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: msg })
      }).then(async (r)=>{
        try {
          const j = await r.json();
          const out = (j && typeof j.out !== 'undefined') ? String(j.out) : `[echo missing] status=${r.status}`;
          setLines((prev)=>[...prev, out]);
        } catch (e:any) {
          setLines((prev)=>[...prev, `[echo parse error] status=${r.status}`]);
        }
      }).catch(async ()=>{
        // Fallback to alt path
        try {
          const r2 = await fetch(alt, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: msg }) });
          const j2 = await r2.json();
          const out2 = (j2 && typeof j2.out !== 'undefined') ? String(j2.out) : `[echo missing] status=${r2.status}`;
          setLines((prev)=>[...prev, out2]);
        } catch (e:any) {
          setLines((prev)=>[...prev, `[echo request error] ${String(e)}`]);
        }
      });
    }
    setInput("");
  }

  if (showBootstrap && projectId) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-sm font-medium">Agent Configuration</span>
          <button
            onClick={() => setShowBootstrap(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Show Console →
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <AgentBootstrap projectId={projectId} sandboxId={sandboxId} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {projectId && (
        <div className="flex justify-between items-center mb-2 px-2">
          <span className="text-sm font-medium">Agent Console</span>
          <button
            onClick={() => setShowBootstrap(true)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Show Configuration
          </button>
        </div>
      )}
      <div className="flex-1 grid grid-rows-[1fr_auto]">
        <div ref={ref} className="overflow-auto font-mono text-xs bg-zinc-950 text-zinc-300 rounded-md p-2" style={{boxShadow:'0 0 0 1px rgba(64,224,208,0.18), 0 0 36px rgba(64,224,208,0.12)'}}>
          {lines.map((l, i) => (<div key={i} className="whitespace-pre-wrap">{l}</div>))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Type /task build a hello page" className="flex-1 px-2 py-1 rounded border border-zinc-700 bg-black/30 text-zinc-200" />
          <button onClick={send} className="px-3 py-1 rounded border border-zinc-700 text-zinc-200">Send</button>
        </div>
      </div>
    </div>
  );
}


