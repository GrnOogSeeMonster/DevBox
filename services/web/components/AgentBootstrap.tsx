"use client";
import React, { useEffect, useState } from "react";

interface FactorySession {
  model: string;
  stack: string;
  purpose: string;
  projectName: string;
  created_at: string;
}

interface CLIInfo {
  name: string;
  command: string;
  envVar: string;
  promptFile: string;
}

export default function AgentBootstrap({ 
  projectId, 
  sandboxId 
}: { 
  projectId: string;
  sandboxId: string;
}) {
  const [session, setSession] = useState<FactorySession | null>(null);
  const [cliInfo, setCLIInfo] = useState<CLIInfo | null>(null);
  const [kickoff, setKickoff] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFactorySession();
  }, [projectId]);

  async function loadFactorySession() {
    try {
      // Load factory session data
      const res = await fetch(`/api/projects/${projectId}/files?path=.factory/session.json`);
      if (res.ok) {
        const data = await res.json();
        const sessionData = JSON.parse(data.content);
        setSession(sessionData);
        
        // Determine CLI info based on model
        const cliMap: Record<string, CLIInfo> = {
          "Claude Code": {
            name: "Claude",
            command: "claude",
            envVar: "CLAUDE_API_KEY",
            promptFile: ".factory/claude.md"
          },
          "Codex (GPT-5)": {
            name: "Codex",
            command: "codex",
            envVar: "OPENAI_API_KEY",
            promptFile: ".factory/codex.md"
          },
          "Gemini CLI": {
            name: "Gemini",
            command: "gemini",
            envVar: "GEMINI_API_KEY",
            promptFile: ".factory/GEMINI.md"
          }
        };
        
        const cli = cliMap[sessionData.model] || cliMap["Gemini CLI"];
        setCLIInfo(cli);
        
        // Generate kickoff prompt
        const kickoffText = generateKickoff(sessionData);
        setKickoff(kickoffText);
      }
    } catch (error) {
      console.error("Failed to load factory session:", error);
    } finally {
      setLoading(false);
    }
  }

  function generateKickoff(session: FactorySession): string {
    return `## Kickoff (Factory Run)

**Project**: ${session.projectName}
**Model/Stack/Purpose**: ${session.model} / ${session.stack} / ${session.purpose}

Follow the Agentic Application Factory loop:

1. **Clarify** requirements (ask concise questions if needed)
2. **Plan** minimal architecture (KISS) - list components & dependencies
3. **Retrieve** facts (no guessing) - mark unknowns as TODOs
4. **Scaffold** repository for ${session.stack} targeting ${session.purpose}
5. **Implement** iteratively with DRY refactors and self-review
6. **Test/verify** after each step (lint/typecheck/run)
7. **Refine** by eliminating duplication and improving clarity
8. **Finalize** with complete code, run instructions, and next steps

### Constraints
- No hardcoded secrets or API keys
- No fabricated APIs or libraries
- Keep code simple and maintainable
- Remove duplication through abstraction

### Deliverables
- Runnable ${session.stack} scaffold
- Core ${session.purpose} features implemented
- README with exact setup commands
- Clean, well-commented code

Begin by understanding what specific features are needed for this ${session.purpose}.`;
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  async function openTerminal() {
    // Open a new terminal tab or window
    // This would integrate with the terminal component
    console.log("Opening terminal with command:", cliInfo?.command);
    // TODO: Integrate with terminal component
  }

  if (loading) {
    return (
      <div className="p-4 text-zinc-400">
        Loading factory configuration...
      </div>
    );
  }

  if (!session || !cliInfo) {
    return (
      <div className="p-4 text-zinc-400">
        <p>No factory session found. Using default agent configuration.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* CLI Selection Indicator */}
      <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <div className="text-xs text-zinc-500 mb-1">Selected Model</div>
        <div className="text-lg font-medium text-brand">{session.model}</div>
        <div className="text-sm text-zinc-400 mt-1">{session.stack} • {session.purpose}</div>
      </div>

      {/* Environment Checklist */}
      <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <div className="text-sm font-medium mb-2">Setup Checklist</div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded" />
            <span>Set {cliInfo.envVar} environment variable</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded" />
            <span>Install {cliInfo.name} CLI: <code className="px-1 bg-zinc-800 rounded">npm install -g {cliInfo.command}</code></span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded" />
            <span>Verify prompt file exists: <code className="px-1 bg-zinc-800 rounded">{cliInfo.promptFile}</code></span>
          </label>
        </div>
      </div>

      {/* Launch Command */}
      <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <div className="text-sm font-medium mb-2">Launch Command</div>
        <div className="flex gap-2">
          <code className="flex-1 px-3 py-2 bg-black rounded border border-zinc-700 text-brand">
            {cliInfo.command}
          </code>
          <button
            onClick={() => copyToClipboard(cliInfo.command, "command")}
            className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            {copied === "command" ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={openTerminal}
            className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-sm bg-brand/10 text-brand"
          >
            Open Terminal
          </button>
        </div>
      </div>

      {/* Kickoff Prompt */}
      <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium">Kickoff Prompt</div>
          <button
            onClick={() => copyToClipboard(kickoff, "kickoff")}
            className="px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
          >
            {copied === "kickoff" ? "Copied!" : "Copy Prompt"}
          </button>
        </div>
        <div className="bg-black rounded p-3 text-xs font-mono text-zinc-300 max-h-64 overflow-auto whitespace-pre-wrap">
          {kickoff}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-zinc-500 space-y-1">
        <p>1. Complete the setup checklist above</p>
        <p>2. Open a terminal in the project directory</p>
        <p>3. Run the launch command to start {cliInfo.name}</p>
        <p>4. Paste the kickoff prompt to begin development</p>
      </div>
    </div>
  );
}
