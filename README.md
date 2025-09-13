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
- Preview: `https://preview-<sandbox-id>.sandboxes.devbox.local`

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
