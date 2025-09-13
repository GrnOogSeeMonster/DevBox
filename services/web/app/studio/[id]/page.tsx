"use client";
import React, { useEffect, useMemo, useState } from "react";
import FileTree from "../../../components/FileTree";
import EditorPane from "../../../components/EditorPane";
import LogsPane from "../../../components/LogsPane";

export default function StudioPage({ params }: { params: { id: string } }) {
  const [currentPath, setCurrentPath] = useState<string>("README.md");
  const [content, setContent] = useState<string>("Loading...");
  const [previewHost, setPreviewHost] = useState<string | null>(null);
  const [sid, setSid] = useState<string>(params.id);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('sid') || params.id;
    setSid(s);
    openFile(currentPath);
    setPreviewHost(`preview-${s}.sandboxes.devbox.local`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function openFile(path: string) {
    const r = await fetch(`/api/files?projectId=${params.id}&path=${encodeURIComponent(path)}`);
    const data = await r.json();
    if (data.content) setContent(data.content);
    setCurrentPath(path);
  }

  async function saveFile(newContent: string) {
    setContent(newContent);
    await fetch(`/api/files/write?projectId=${params.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'write', path: currentPath, content: newContent })
    });
  }

  const previewUrl = useMemo(() => previewHost ? `https://${previewHost}` : "about:blank", [previewHost]);

  return (
    <div className="h-screen grid grid-rows-[1fr_auto]">
      <div className="grid grid-cols-[280px_1fr_1fr] gap-0">
        <div className="border-r border-zinc-800 p-2 overflow-y-auto">
          <FileTree projectId={params.id} onOpen={openFile} />
        </div>
        <div className="border-r border-zinc-800">
          <EditorPane path={currentPath} value={content} onChange={saveFile} />
        </div>
        <div>
          <iframe title="Preview" src={previewUrl} className="w-full h-full bg-white" />
        </div>
      </div>
      <div className="border-t border-zinc-800 p-2 text-sm text-zinc-400">
        <LogsPane sandboxId={sid} />
      </div>
    </div>
  );
}
