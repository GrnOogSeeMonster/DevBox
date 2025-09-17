"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface APIKeys {
  claude: string;
  codex: string;
  gemini: string;
}

export default function ConfigPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<APIKeys>({
    claude: "",
    codex: "",
    gemini: ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({
    claude: false,
    codex: false,
    gemini: false
  });

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const res = await fetch("/api/config/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys({
          claude: data.claude || "",
          codex: data.codex || "",
          gemini: data.gemini || ""
        });
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  }

  async function saveKeys() {
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await fetch("/api/config/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys)
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: "API keys saved successfully!" });
        
        // Validate keys if provided
        if (data.validation) {
          const failed = Object.entries(data.validation)
            .filter(([_, valid]) => !valid)
            .map(([key]) => key);
          
          if (failed.length > 0) {
            setMessage({
              type: "error",
              text: `Warning: The following keys failed validation: ${failed.join(", ")}`
            });
          }
        }
      } else {
        const error = await res.text();
        setMessage({ type: "error", text: `Failed to save: ${error}` });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save API keys" });
    } finally {
      setSaving(false);
    }
  }

  function toggleShowKey(key: string) {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function maskKey(key: string): string {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 4) + "••••" + key.substring(key.length - 4);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">API Configuration</h1>
            <p className="text-zinc-400">Configure your AI model API keys for DevBox Studio</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition"
          >
            Back to Home
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === "success" 
              ? "bg-green-900/20 border-green-800 text-green-300"
              : "bg-red-900/20 border-red-800 text-red-300"
          }`}>
            {message.text}
          </div>
        )}

        {/* API Keys Form */}
        <div className="space-y-6">
          {/* Claude API Key */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium mb-1">Claude Code</h3>
                <p className="text-sm text-zinc-400">
                  Advanced coding assistant with deep codebase understanding
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-zinc-800 rounded">CLAUDE_API_KEY</span>
            </div>
            <div className="flex gap-2">
              <input
                type={showKeys.claude ? "text" : "password"}
                value={keys.claude}
                onChange={(e) => setKeys({ ...keys, claude: e.target.value })}
                placeholder="sk-ant-api03-..."
                className="flex-1 px-4 py-2 bg-black rounded-lg border border-zinc-700 focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => toggleShowKey("claude")}
                className="px-3 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800"
              >
                {showKeys.claude ? "Hide" : "Show"}
              </button>
            </div>
            {keys.claude && !showKeys.claude && (
              <p className="text-xs text-zinc-500 mt-2">Current: {maskKey(keys.claude)}</p>
            )}
          </div>

          {/* Codex API Key */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium mb-1">Codex (GPT-5)</h3>
                <p className="text-sm text-zinc-400">
                  State-of-the-art coding model with exceptional SWE performance
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-zinc-800 rounded">OPENAI_API_KEY</span>
            </div>
            <div className="flex gap-2">
              <input
                type={showKeys.codex ? "text" : "password"}
                value={keys.codex}
                onChange={(e) => setKeys({ ...keys, codex: e.target.value })}
                placeholder="sk-..."
                className="flex-1 px-4 py-2 bg-black rounded-lg border border-zinc-700 focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => toggleShowKey("codex")}
                className="px-3 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800"
              >
                {showKeys.codex ? "Hide" : "Show"}
              </button>
            </div>
            {keys.codex && !showKeys.codex && (
              <p className="text-xs text-zinc-500 mt-2">Current: {maskKey(keys.codex)}</p>
            )}
          </div>

          {/* Gemini API Key */}
          <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium mb-1">Gemini CLI</h3>
                <p className="text-sm text-zinc-400">
                  Open-source AI agent with 1M-token context and Google Search grounding
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-zinc-800 rounded">GEMINI_API_KEY</span>
            </div>
            <div className="flex gap-2">
              <input
                type={showKeys.gemini ? "text" : "password"}
                value={keys.gemini}
                onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
                placeholder="AIza..."
                className="flex-1 px-4 py-2 bg-black rounded-lg border border-zinc-700 focus:border-brand focus:outline-none"
              />
              <button
                onClick={() => toggleShowKey("gemini")}
                className="px-3 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800"
              >
                {showKeys.gemini ? "Hide" : "Show"}
              </button>
            </div>
            {keys.gemini && !showKeys.gemini && (
              <p className="text-xs text-zinc-500 mt-2">Current: {maskKey(keys.gemini)}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mt-8">
          <div className="text-sm text-zinc-400">
            <p>💡 Tip: You only need to configure keys for the models you plan to use.</p>
            <p className="mt-1">Keys are stored securely and never exposed in logs or UI.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveKeys}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-brand text-black font-medium hover:bg-brand/90 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
