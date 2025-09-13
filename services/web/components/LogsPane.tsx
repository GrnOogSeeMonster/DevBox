"use client";
import React, { useEffect, useRef, useState } from "react";

export default function LogsPane({ sandboxId }: { sandboxId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = `wss://orchestrator.devbox.local/logs/${sandboxId}`;
    const ws = new WebSocket(host);
    ws.onmessage = (ev) => {
      setLines((prev) => [...prev, ev.data as string].slice(-500));
    };
    ws.onerror = () => setLines((prev) => [...prev, "[ws error]"]);
    return () => ws.close();
  }, [sandboxId]);

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
