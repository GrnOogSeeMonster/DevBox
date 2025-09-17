# DevBox Wizard and Session Flow – Fix Report

## Summary

This update makes the Start New Session wizard deterministic and repeatable. It fixes preview routing, sandbox startup reliability, and persists session state. It also adds a CLI for programmatic session creation and an E2E smoke test.

## Root Causes

- Preview proxy misrouted to `http://localhost:8000/sandboxes/...` instead of the internal API base `http://api:8000/api`.
- Studio embedded the preview via subdomain; DNS can fail locally. No stable path-based route was enforced.
- Orchestrator launched containers with read-only filesystem and without deterministic pnpm store, causing flaky installs and startup.
- No persisted `session.json` to resume/retry deterministically.
- No CLI to unify “build X” workflows.

## Fixes

- Web preview API now targets `API_INTERNAL_URL=/api` base and proxies reliably.
- Studio preview URL unified to path-based: `/api/preview/{sandboxId}`.
- Orchestrator now uses writable workspace, pnpm store at `/workspace/.pnpm-store`, frozen lockfile when present, and prints a stable `PREVIEW_URL`.
- API persists `/workspaces/<projectId>/session.json` upon sandbox creation.
- CLI (`python -m app.cli`) supports `new` and `build` commands, outputs machine-readable JSON with `project_id`, `sandbox_id`, and `preview_url`.
- Added E2E smoke test to validate end-to-end flow.

## How to Run

1. `make bootstrap && make up`
2. In the browser, open `https://localhost` → Start New Session → select model/stack/purpose.
3. You are redirected to Studio and the preview loads from `/api/preview/{sandboxId}`.

CLI:

```
make cli NEW="next" NAME="My App" MODEL="gemini" PURPOSE="modern-web"
```

Output JSON includes `preview_url` suitable for embedding.

E2E Test:

```
docker compose exec api python -m app.tests.e2e_smoke
```

## Known Limitations

- DNS-based subdomain previews still require hosts/wildcard TLS; path-based preview is the supported default.
- Some templates without lockfiles may install with best-effort (`--frozen-lockfile || pnpm install`).


