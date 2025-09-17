# DevBox Studio (Local Sandbox Platform)

A Docker Compose stack providing a codesandbox-style local experience with browser IDE, sandboxed previews, and instant feedback.

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
