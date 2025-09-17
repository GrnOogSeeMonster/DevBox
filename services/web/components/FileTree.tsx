"use client";
import React, { useEffect, useState } from "react";

export interface FileNode { name: string; path: string; type: "file"|"dir"; }

export default function FileTree({ projectId, onOpen }: { projectId: string; onOpen: (path: string) => void; }) {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [cwd, setCwd] = useState<string>("/");

  useEffect(() => { load(cwd); }, [projectId, cwd]);

  async function load(path: string) {
    const r = await fetch(`/api/files?projectId=${projectId}&path=${encodeURIComponent(path)}`);
    const data = await r.json();
    setNodes(data.items || []);
  }

  return (
    <div className="text-sm">
      <div className="px-2 py-1 text-zinc-400 border-b border-zinc-800">{cwd}</div>
      <ul className="p-2 space-y-1">
        {cwd !== "/" && <li><button className="text-zinc-400" onClick={()=> setCwd(cwd.split('/').slice(0,-1).join('/') || '/')}>..</button></li>}
        {nodes.map(n => (
          <li key={n.path}>
            {n.type === 'dir' ? (
              <button className="text-zinc-300 hover:text-white" onClick={()=> setCwd(`/` + n.path.replace(/^\/+/, ''))}>{n.name}/</button>
            ) : (
              <button className="text-zinc-300 hover:text-white" onClick={()=> onOpen(n.path)}>{n.name}</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
