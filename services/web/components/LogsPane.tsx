"use client";
import React, { useEffect, useRef, useState } from "react";

export default function LogsPane({ sandboxId, projectId }: { sandboxId: string; projectId?: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const fallbackTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    let host = `${proto}://orchestrator.devbox.local/logs/${sandboxId}`;
    // Fallback to localhost path-based proxy if needed in future
    const ws = new WebSocket(host);
    ws.onmessage = (ev) => {
      setLines((prev) => [...prev, ev.data as string].slice(-500));
    };
    ws.onerror = () => {
      setLines((prev) => [...prev, `[ws error] connect to ${host}`]);
      // Fallback: poll session.log via API if projectId available
      if (projectId && !fallbackTimer.current) {
        const tick = async () => {
          try {
            const r = await fetch(`/api/projects/${projectId}/session-log`);
            if (r.ok) {
              const body = await r.text();
              const tail = body.trim().split('\n').slice(-100);
              setLines(tail);
            }
          } catch {}
          fallbackTimer.current = setTimeout(tick, 2000);
        };
        tick();
      }
    };
    return () => {
      ws.close();
      if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
    };
  }, [sandboxId, projectId]);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);

  return (
    <div ref={ref} className="h-40 overflow-auto font-mono text-xs bg-zinc-950 text-zinc-300 rounded-md">
      {lines.map((l, i) => (
        <div key={i} className="px-3 py-0.5 whitespace-pre-wrap">{l}</div>
      ))}
    </div>
  );
}
