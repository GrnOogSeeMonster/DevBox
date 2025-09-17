# DevBox Wizard Flow

This document maps the Start New Session wizard end-to-end.

## Entry points

- Web UI: `services/web/app/(studio)/wizard/WizardClient.tsx`
- Headless CLI: `docker compose exec api python -m app.cli new --stack <stack> --name <name> --model <model> --purpose <purpose>`
- Headless (config): `docker compose exec api python -m app.cli config --file /app/app/devbox.wizard.yaml`

## Decision tree (simplified)

- Model: `claude|codex|gemini` (informational)
- Stack: `next|vite-react|sveltekit|vite-vue|static|blank|node|fastapi|django|nestjs`
- Purpose: `modern-web|backend|game|traditional|static|manual`

## Resulting artifacts

- DB rows: `project`, `sandbox`
- Workspace on host: `/workspaces/<projectId>`
  - `template.json`, `package.json`, template files
  - `project.config.json`, `SANDBOX_CONTEXT.md`
  - `session.json`, `session.log`

## Backend steps

1. API `POST /api/projects` creates project row, workspace, writes `project.config.json` and `SANDBOX_CONTEXT.md`.
2. API `POST /api/projects/{projectId}/sandboxes` creates sandbox row, calls Orchestrator `/sandboxes`.
3. Orchestrator copies template and starts a container:
   - Pre-populates `/workspace` inside container with template and `.sandbox-entry.sh`.
   - Entry script logs diagnostics, installs deps, starts dev server.
   - Orchestrator waits for dev server HTTP on declared port; returns status.
4. Web Studio opens `/api/preview/{sandboxId}` which proxies to `http://sandbox-<sid>:<port>/`.

## Common failures and fixes

- Missing package manager or lock: entry script falls back to `npm install` and `npx next dev`.
- Port not ready: orchestrator waits with timeout and logs `[orchestrator] timeout waiting for dev server`.
- DNS issues: Studio uses path-based preview.

## Inputs and validation

- Inputs: `name`, `stack`, `purpose`, `model`.
- Defaults: `model=gemini`, `stack=next`, `purpose=modern-web`.
- Headless config schema: `devbox.wizard.schema.json`.

## Idempotency

- Re-running project creation with same name produces a new project id (non-destructive) by design.
- File generation is copy-once; existing files are left intact.
- Session can be restarted via API `POST /api/sandboxes/{id}/restart` (stateless for now).


