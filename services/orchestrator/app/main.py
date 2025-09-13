from __future__ import annotations

import asyncio
import json
import os
import tarfile
import io
from pathlib import Path
from typing import Any
from uuid import UUID

import docker
from docker.models.containers import Container
from fastapi import FastAPI, WebSocket, HTTPException
from pydantic import BaseModel

app = FastAPI(title="DevBox Orchestrator", version="0.1.0")

DOCKER = docker.from_env()
WORKSPACES = Path("/workspaces")
PROJECT_NAME = os.getenv("COMPOSE_PROJECT_NAME", "devbox")
DEFAULT_NETWORK = f"{PROJECT_NAME}_default"
SECURITY_OPTS = ["no-new-privileges:true"]
CPU_LIMIT = float(os.getenv("SANDBOX_DEFAULT_CPU", "0.5"))
MEM_LIMIT = os.getenv("SANDBOX_DEFAULT_MEM", "512m")

TEMPLATES_DIR = Path("/app/templates")


class SandboxCreate(BaseModel):
    sandbox_id: UUID
    project_id: UUID
    stack: str


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
def metrics() -> str:
    return "# HELP devbox_orchestrator_up 1 if the orchestrator is up\n# TYPE devbox_orchestrator_up gauge\ndevbox_orchestrator_up 1\n"


@app.post("/sandboxes")
def create_sandbox(body: SandboxCreate) -> dict:
    workspace = WORKSPACES / str(body.project_id)
    workspace.mkdir(parents=True, exist_ok=True)

    template_dir = TEMPLATES_DIR / body.stack
    if not template_dir.exists():
        raise HTTPException(status_code=400, detail="Unsupported stack")

    _copy_template(template_dir, workspace)

    meta = json.loads((template_dir / "template.json").read_text(encoding="utf-8"))
    port = int(meta.get("port", 5173))
    dev_cmd = meta.get("dev_command", "pnpm dev --host 0.0.0.0 --port 5173")

    sid = str(body.sandbox_id)
    preview_host = f"preview-{sid}.sandboxes.devbox.local"
    path_router = f"previewpath-{sid}"
    strip_mw = f"strip-{sid}"

    labels = {
        # Subdomain router (works when wildcard DNS available)
        "traefik.enable": "true",
        f"traefik.http.routers.preview-{sid}.rule": f"Host(`{preview_host}`)",
        f"traefik.http.routers.preview-{sid}.entrypoints": "websecure",
        f"traefik.http.routers.preview-{sid}.tls": "true",
        f"traefik.http.routers.preview-{sid}.middlewares": "security-headers@file",
        f"traefik.http.services.preview-{sid}.loadbalancer.server.port": str(port),
        # Path-based fallback router: https://sandboxes.devbox.local/preview/<id>
        f"traefik.http.routers.{path_router}.rule": f"Host(`sandboxes.devbox.local`) && PathPrefix(`/preview/{sid}`)",
        f"traefik.http.routers.{path_router}.entrypoints": "websecure",
        f"traefik.http.routers.{path_router}.tls": "true",
        f"traefik.http.routers.{path_router}.middlewares": f"security-headers@file,{strip_mw}",
        f"traefik.http.middlewares.{strip_mw}.stripPrefix.prefixes": f"/preview/{sid}",
        f"traefik.http.services.{path_router}.loadbalancer.server.port": str(port),
    }

    container = DOCKER.containers.run(
        image="node:20-bullseye-slim",
        name=f"sandbox-{sid}",
        command=["sh", "-lc", f"corepack enable && pnpm i && {dev_cmd}"],
        working_dir="/workspace",
        user="node",
        detach=True,
        network_disabled=True,
        labels=labels,
        environment={
            "PREVIEW_URL": f"https://{preview_host}",
            "SANDBOX_CONTEXT_PATH": "/workspace/SANDBOX_CONTEXT.md",
            "STACK_NAME": body.stack,
        },
        volumes={
            str(workspace): {"bind": "/workspace", "mode": "rw"},
        },
        security_opt=SECURITY_OPTS,
        mem_limit=MEM_LIMIT,
        nano_cpus=int(CPU_LIMIT * 1e9),
        read_only=True,
        mounts=[],
        tty=True,
    )

    return {
        "status": "running",
        "container_id": container.id,
        "preview_host": preview_host,
        "port": port,
    }


@app.post("/sandboxes/{sandbox_id}/start")
def start_sandbox(sandbox_id: str) -> dict:
    c = _get_container(sandbox_id)
    c.start()
    return {"status": "running"}


@app.post("/sandboxes/{sandbox_id}/stop")
def stop_sandbox(sandbox_id: str) -> dict:
    c = _get_container(sandbox_id)
    c.stop(timeout=5)
    return {"status": "stopped"}


@app.post("/sandboxes/{sandbox_id}/network")
def toggle_network(sandbox_id: str, enable: bool) -> dict:
    net = DOCKER.networks.get(DEFAULT_NETWORK)
    c = _get_container(sandbox_id)
    try:
        if enable:
            net.connect(c)
        else:
            net.disconnect(c)
    except Exception:
        pass
    return {"enabled": enable}


@app.websocket("/logs/{sandbox_id}")
async def logs_ws(websocket: WebSocket, sandbox_id: str) -> None:
    await websocket.accept()
    try:
        c = _get_container(sandbox_id)
        await websocket.send_text(_preamble(sandbox_id))
        for line in c.logs(stream=True, follow=True, tail=100):
            try:
                await websocket.send_text(line.decode(errors="ignore"))
            except Exception:
                break
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# Helpers

def _get_container(sandbox_id: str) -> Container:
    name = sandbox_id if sandbox_id.startswith("sandbox-") else f"sandbox-{sandbox_id}"
    try:
        return DOCKER.containers.get(name)
    except docker.errors.NotFound:
        return DOCKER.containers.get(sandbox_id)


def _copy_template(template_dir: Path, workspace: Path) -> None:
    for path in template_dir.rglob("*"):
        rel = path.relative_to(template_dir)
        dest = workspace / rel
        if path.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
        else:
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(path.read_bytes())


def _preamble(sandbox_id: str) -> str:
    return (
        """
Welcome to DevBox CLI
- Working dir: /workspace
- Objectives: Keep preview live on the right. Hot reload. Minimal friction.
Commands: /help, /status, /run <cmd>
        """.strip()
    )
