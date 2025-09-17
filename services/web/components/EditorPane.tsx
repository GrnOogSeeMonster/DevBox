"use client";
import React from "react";
import Editor from "@monaco-editor/react";

export default function EditorPane({ value, onChange, path }: { value: string; onChange: (v: string) => void; path: string; }) {
  const language = path.endsWith(".tsx") || path.endsWith(".ts") ? "typescript" : path.endsWith(".jsx") || path.endsWith(".js") ? "javascript" : path.endsWith(".json") ? "json" : path.endsWith(".css")?"css":"markdown";
  return (
    <div className="h-full">
      <Editor height="100%" theme="vs-dark" defaultLanguage={language} language={language} value={value} onChange={(v)=>onChange(v || "")} options={{ fontSize: 14, minimap: { enabled: false }, smoothScrolling: true }} />
    </div>
  );
}
