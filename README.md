# DevBox Studio (Local Sandbox Platform)


A local CodeSandbox: a wizard picks a model, a stack and a purpose, the orchestrator
spins a sandboxed container with that scaffold and an AI CLI already installed, and the
Studio gives you a file tree, Monaco, a live preview and streaming logs against it.

---

## Status

**Working. The wizard-to-preview loop runs end to end.** Last worked on
17 September 2025.

| | |
|---|---|
| Size | ~4,000 lines across a FastAPI API, a Docker orchestrator and a Next.js Studio |
| Working | Wizard, session creation, container orchestration, path-based preview proxy, file CRUD, WebSocket logs, encrypted API-key storage, CLI |
| Partial | Editor pane is a shell around Monaco; `make test` is a placeholder target |
| Tests | An e2e smoke script (`services/api/tests/e2e_smoke.py`) plus one API test file |
| Verified | `docs/fix-report.md` records the debugging pass that made the wizard-to-preview path deterministic |

### What is built

| Component | Lines | |
|---|---|---|
| `services/api/app/main.py` | 516 | Project and sandbox creation, file CRUD, import/export, session persistence |
| `services/orchestrator/app/main.py` | 479 | Docker SDK container lifecycle, template scaffolding, pnpm store caching, preview URL emission |
| `services/web/lib/sessionOrchestrator.ts` | 406 | Pattern resolution — binds model + stack + purpose to a CLI and a scaffold |
| `services/web/app/(studio)/wizard/` | 306 | The wizard, with API-key validation gating session creation |
| `services/web/app/config/page.tsx` | 244 | API-key management UI (Fernet-encrypted at rest) |
| `services/web/components/AgentBootstrap.tsx` | 221 | Per-session setup checklist, launch command and generated kickoff prompt |
| `services/api/app/cli.py` | 77 | `python -m app.cli new` / `build` — machine-readable JSON output |

`.factory/` holds the design that drives it: `algorithm.md` (the factory algorithm each
session bootstraps with), `pattern-map.json` (CLI and stack bindings) and
`patterns.json` (the pattern audit).

### Known limitations

- The AI CLI package names in the container bootstrap are placeholders, not the real
  published packages.
- DNS-based subdomain previews need hosts entries and wildcard TLS; the path-based
  preview is the supported default.
- Templates without a lockfile fall back to a best-effort install.
- Sandboxes have no network by default and it is toggled explicitly for installs — good
  for isolation, occasionally surprising during development.

---

## Prerequisites
- Docker Desktop or Docker Engine
- mkcert installed (script assists)

## Quickstart
```bash
make bootstrap
make up
```
Add to /etc/hosts (script will prompt):
```
127.0.0.1 studio.devbox.local api.devbox.local sandboxes.devbox.local orchestrator.devbox.local
```
Open `https://studio.devbox.local`.

## What you get
- Wizard: Model → Stack → Purpose with dynamic CTA
- Editor: File tree + Monaco, split preview, logs
- API: project/sandbox creation, file CRUD, import/export
- Orchestrator: Docker SDK, preview via Traefik wildcard

## Routes
- UI: `https://studio.devbox.local`
- API: `https://api.devbox.local`
- Orchestrator WS logs: `wss://orchestrator.devbox.local/logs/<sandboxId>`
- Preview (path-based, deterministic): `https://studio.devbox.local/api/preview/<sandbox-id>`
- Preview (DNS-based, optional): `https://preview-<sandbox-id>.sandboxes.devbox.local`

## Commands
```bash
make bootstrap   # mkcert + hosts helper
make up          # build + start stack
make down        # stop stack
make reset       # nuke containers/volumes
make logs        # tail logs
make test        # run tests (placeholder)
```

## Security
- Sandboxes are unprivileged, readonly rootfs, with resource limits.
- Network is disabled by default and toggled explicitly for installs.

## Adding Templates
Add a folder under `services/orchestrator/templates/<stack>` with `template.json` and scaffold files.

## Troubleshooting
- If TLS errors, trust mkcert root and re-run `make bootstrap`.
- On Windows, run from WSL for best compatibility.
- If preview is blank, confirm the sandbox dev server started and visit the path-based URL above.

## Deterministic Sessions and CLI

- Session metadata is saved at `/workspaces/<projectId>/session.json` when a sandbox is created.
- Orchestrator uses a writeable workspace and caches pnpm store at `/workspaces/<projectId>/.pnpm-store` for deterministic installs.
- The Studio always embeds preview via the path router for reliability.
