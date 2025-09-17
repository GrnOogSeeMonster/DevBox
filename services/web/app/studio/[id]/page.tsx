"use client";
import React, { useEffect, useMemo, useState } from "react";
import FileTree from "../../../components/FileTree";
import EditorPane from "../../../components/EditorPane";
import LogsPane from "../../../components/LogsPane";
import AgentPane from "../../../components/AgentPane";

export default function StudioPage({ params }: { params: { id: string } }) {
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [content, setContent] = useState<string>("Loading...");
  const [previewHost, setPreviewHost] = useState<string | null>(null);
  const [sid, setSid] = useState<string>(params.id);
  const [leftTab, setLeftTab] = useState<"agent"|"editor"|"files">("agent");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('sid') || params.id;
    setSid(s);
    // Load root dir, then pick a sensible default file
    loadRootAndOpenDefault();
    // Poll preview readiness to avoid blank iframe on first load
    const start = Date.now();
    const poll = async () => {
      try {
        const head = await fetch(`${window.location.origin}/api/preview/${s}`, { method: 'HEAD' });
        if (head.ok) {
          setPreviewHost('ready');
          return;
        }
      } catch {}
      if (Date.now() - start < 120000) setTimeout(poll, 2000);
    };
    poll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadRootAndOpenDefault() {
    try {
      const r = await fetch(`/api/files?projectId=${params.id}&path=${encodeURIComponent('/')}`);
      const data = await r.json();
      if (data && data.items) {
        // Prefer common entry files
        const prefs = [
          'README.md', 'readme.md', 'README.scaffold.md',
          'app/page.tsx', 'src/routes/+page.svelte', 'index.html'
        ];
        let pick: string | null = null;
        for (const p of prefs) {
          if (data.items.find((i: any) => i.path === p)) { pick = p; break; }
        }
        if (!pick) {
          const first = data.items.find((i: any) => i.type === 'file') || data.items[0];
          pick = first ? first.path : 'README.scaffold.md';
        }
        await openFile(pick);
        return;
      }
    } catch {}
    // Fallback
    await openFile('README.scaffold.md');
  }

  async function openFile(path: string) {
    const r = await fetch(`/api/projects/${params.id}/files?path=${encodeURIComponent(path)}`);
    if (!r.ok) {
      setContent(`Failed to load ${path}: ${r.status}`);
      setCurrentPath(path);
      return;
    }
    const data = await r.json();
    if (data.content) setContent(data.content);
    setCurrentPath(path);
  }

  async function saveFile(newContent: string) {
    setContent(newContent);
    await fetch(`/api/projects/${params.id}/files`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'write', path: currentPath, content: newContent })
    });
  }

  const previewUrl = useMemo(() => {
    const s = sid;
    // Always use path-based preview via web router to avoid DNS issues
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/api/preview/${s}`;
  }, [sid]);

  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
        <div className="text-lg tracking-wide text-zinc-200">DevBox Studio</div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200" onClick={()=>window.location.reload()}>Run</button>
          <a href={`/api/projects/${params.id}/export`} className="px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200">Download</a>
        </div>
      </div>
      <div className="grid grid-cols-[1.2fr_1fr] gap-4 p-4 min-h-0">
        <div className="border border-zinc-800 rounded-lg flex flex-col min-h-0 bg-zinc-950/60" style={{boxShadow:'0 0 0 1px rgba(64,224,208,0.18), 0 0 36px rgba(64,224,208,0.12)'}}>
          <div className="px-3 py-2 text-xs text-zinc-400 border-b border-zinc-800 flex items-center gap-2">
            <button onClick={()=>setLeftTab("agent")} className={`px-2.5 py-1 rounded-md border ${leftTab==='agent'?'border-zinc-600 bg-zinc-800 text-zinc-200':'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}>Agent</button>
            <button onClick={()=>setLeftTab("editor")} className={`px-2.5 py-1 rounded-md border ${leftTab==='editor'?'border-zinc-600 bg-zinc-800 text-zinc-200':'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}>Editor</button>
            <button onClick={()=>setLeftTab("files")} className={`px-2.5 py-1 rounded-md border ${leftTab==='files'?'border-zinc-600 bg-zinc-800 text-zinc-200':'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}>Files</button>
          </div>
          <div className="flex-1 min-h-0 p-3 overflow-auto">
            {leftTab === "agent" && (<AgentPane sandboxId={sid} projectId={params.id} />)}
            {leftTab === "editor" && (<EditorPane path={currentPath} value={content} onChange={saveFile} />)}
            {leftTab === "files" && (<FileTree projectId={params.id} onOpen={openFile} />)}
          </div>
        </div>
        <div className="relative flex flex-col overflow-hidden min-h-0 border border-zinc-800 rounded-lg bg-zinc-950/60" style={{boxShadow:'0 0 0 1px rgba(64,224,208,0.18), 0 0 36px rgba(64,224,208,0.12)'}}>
          <div className="px-3 py-2 text-xs text-zinc-400 border-b border-zinc-800">Preview</div>
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 text-xs rounded-md border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:text-white"
            >
              Open preview ↗
            </a>
            <button
              onClick={() => { /* trigger reload */ (document.querySelector('iframe[title="Preview"]') as HTMLIFrameElement)?.contentWindow?.location.reload(); }}
              className="px-2.5 py-1 text-xs rounded-md border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:text-white"
            >
              Retry
            </button>
          </div>
          <iframe title="Preview" src={previewUrl} className="w-full h-full bg-white" />
        </div>
      </div>
      <div className="border-t border-zinc-800 text-sm text-zinc-400 p-4 pt-0">
        <div className="px-3 py-2 text-xs text-zinc-400 border border-zinc-800 rounded-t-lg bg-zinc-950/60" style={{boxShadow:'0 0 0 1px rgba(64,224,208,0.18), 0 0 36px rgba(64,224,208,0.12)'}}>Logs</div>
        <div className="border border-t-0 border-zinc-800 rounded-b-lg p-3 bg-zinc-950/60" style={{boxShadow:'0 0 0 1px rgba(64,224,208,0.18), 0 0 36px rgba(64,224,208,0.12)'}}>
          <LogsPane sandboxId={sid} projectId={params.id} />
        </div>
      </div>
    </div>
  );
}
