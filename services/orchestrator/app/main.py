from __future__ import annotations

import asyncio
import json
import os
import tarfile
import io
from pathlib import Path
import time
import urllib.request
from typing import Any
from uuid import UUID

import docker
from docker.models.containers import Container
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi import Body
from pydantic import BaseModel
from datetime import datetime

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

    def log(msg: str) -> None:
        try:
            ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            (workspace / "session.log").open("a", encoding="utf-8").write(f"[{ts}] ORCH:{msg}\n")
        except Exception:
            pass

    template_dir = TEMPLATES_DIR / body.stack
    if not template_dir.exists():
        log("create_sandbox:unsupported_stack")
        raise HTTPException(status_code=400, detail="Unsupported stack")

    log("create_sandbox:copy_template")
    _copy_template(template_dir, workspace)

    meta = json.loads((template_dir / "template.json").read_text(encoding="utf-8"))
    port = int(meta.get("port", 5173))
    dev_cmd = meta.get("dev_command", "pnpm dev --host 0.0.0.0 --port 5173")

    sid = str(body.sandbox_id)
    preview_host = f"preview-{sid}.sandboxes.devbox.local"
    path_router = f"previewpath-{sid}"
    path_router_local = f"previewpath-local-{sid}"
    strip_mw = f"strip-{sid}"

    labels = {
        "traefik.enable": "true",
        # Subdomain router
        f"traefik.http.routers.preview-{sid}.rule": f"Host(`{preview_host}`)",
        f"traefik.http.routers.preview-{sid}.entrypoints": "websecure",
        f"traefik.http.routers.preview-{sid}.tls": "true",
        f"traefik.http.routers.preview-{sid}.middlewares": "security-headers@file",
        f"traefik.http.services.preview-{sid}.loadbalancer.server.port": str(port),
        # Path-based fallback on sandboxes.devbox.local
        f"traefik.http.routers.{path_router}.rule": f"Host(`sandboxes.devbox.local`) && PathPrefix(`/preview/{sid}`)",
        f"traefik.http.routers.{path_router}.entrypoints": "websecure",
        f"traefik.http.routers.{path_router}.tls": "true",
        f"traefik.http.routers.{path_router}.middlewares": f"security-headers@file,{strip_mw}",
        f"traefik.http.middlewares.{strip_mw}.stripPrefix.prefixes": f"/preview/{sid}",
        f"traefik.http.services.{path_router}.loadbalancer.server.port": str(port),
        # Path-based on localhost with higher priority to beat web router
        f"traefik.http.routers.{path_router_local}.rule": f"Host(`localhost`) && PathPrefix(`/preview/{sid}`)",
        f"traefik.http.routers.{path_router_local}.entrypoints": "websecure",
        f"traefik.http.routers.{path_router_local}.tls": "true",
        f"traefik.http.routers.{path_router_local}.middlewares": f"security-headers@file,{strip_mw}",
        f"traefik.http.routers.{path_router_local}.priority": "2000",
        f"traefik.http.services.{path_router_local}.loadbalancer.server.port": str(port),
    }

    # Get model and prepare CLI setup
    model = "gemini"
    cli_command = "gemini"
    if (workspace / "project.config.json").exists():
        try:
            config = json.loads((workspace / "project.config.json").read_text(encoding="utf-8"))
            model = config.get("model", "gemini")
            
            # Map model to CLI command
            cli_map = {
                "claude": "claude",
                "codex": "codex",
                "gemini": "gemini"
            }
            cli_command = cli_map.get(model, "gemini")
        except Exception:
            pass
    
    # Build API key export if available
    api_key_export = ""
    for env_var, value in api_key_env.items():
        api_key_export += f"export {env_var}='{value}'\n"
    
    # Compose a robust entry script on the workspace to avoid inline shell quoting issues
    entry_script = (
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        "cd /workspace\n"
        "exec > >(tee -a /workspace/session.log) 2>&1\n"
        "echo \"[doctor] pwd=$(pwd) node=$(node -v) npm=$(npm -v || true)\"\n"
        "ls -la\n"
        "\n"
        "# Set up environment variables for CLIs\n"
        f"{api_key_export}"
        "\n"
        "# Install CLI tools globally\n"
        "echo \"[cli-setup] Installing AI CLI tools...\"\n"
        "npm install -g @anthropic-ai/claude-cli@latest || echo '[warn] claude CLI install failed'\n"
        "npm install -g openai-codex-cli@latest || echo '[warn] codex CLI install failed'\n"
        "npm install -g @google/gemini-cli@latest || echo '[warn] gemini CLI install failed'\n"
        f"echo \"[cli-setup] Primary CLI: {cli_command}\"\n"
        f"which {cli_command} || echo '[warn] {cli_command} not found in PATH'\n"
        "\n"
        "# Show factory configuration if exists\n"
        "if [ -d /workspace/.factory ]; then\n"
        "  echo \"[factory] Configuration found:\"\n"
        "  ls -la /workspace/.factory/ || true\n"
        "  if [ -f /workspace/.factory/session.json ]; then\n"
        "    echo \"[factory] Session: $(cat /workspace/.factory/session.json | head -1)\"\n"
        "  fi\n"
        "fi\n"
        "\n"
        "export PNPM_HOME=/workspace/.pnpm; export PATH=\"$PNPM_HOME:$PATH\"\n"
        "export NPM_CONFIG_CACHE=/workspace/.npm-cache\n"
        "if [ ! -f package.json ]; then echo '[error] package.json not found'; exit 1; fi\n"
        "if [ -f pnpm-lock.yaml ]; then\n"
        "  corepack enable || true\n"
        "  pnpm config set store-dir /workspace/.pnpm-store || true\n"
        "  pnpm install || pnpm install --no-frozen-lockfile\n"
        f"  CMD='{dev_cmd}'\n"
        "elif command -v pnpm >/dev/null 2>&1; then\n"
        "  pnpm config set store-dir /workspace/.pnpm-store || true\n"
        "  pnpm install || pnpm install --no-frozen-lockfile\n"
        f"  CMD='{dev_cmd}'\n"
        "else\n"
        "  npm install --no-audit --fund=false\n"
        f"  CMD='npx next dev -p {port} -H 0.0.0.0'\n"
        "fi\n"
        "echo \"[sandbox] Starting: $CMD\"\n"
        "exec bash -lc \"$CMD\"\n"
    )
    # Prepare a per-project named volume to ensure the Docker daemon can mount it
    volume_name = f"workspace-{body.project_id}"
    try:
        DOCKER.volumes.get(volume_name)
    except docker.errors.NotFound:
        DOCKER.volumes.create(name=volume_name)

    log("create_sandbox:run_container")
    fallback_cmd = (
        "if [ -f /workspace/.sandbox-entry.sh ]; then "
        "  exec bash /workspace/.sandbox-entry.sh; "
        "else "
        "  echo '[warn] entry script missing; running fallback' | tee -a /workspace/session.log; "
        "  cd /workspace; exec bash -lc \"exec > >(tee -a /workspace/session.log) 2>&1; ls -la; npm install --no-audit --fund=false || true; npx next dev -p %d -H 0.0.0.0\"; "
        "fi"
    ) % (port)

    # Create container (not started yet) so we can copy files before the entry runs
    # Prepare environment with API keys
    container_env = {
        "PREVIEW_URL": f"https://{preview_host}",
        "SANDBOX_CONTEXT_PATH": "/workspace/SANDBOX_CONTEXT.md",
        "STACK_NAME": body.stack,
        "PROJECT_ID": str(body.project_id),
    }
    
    # Add API key to environment if available
    container_env.update(api_key_env)
    
    container = DOCKER.containers.create(
        image="node:20-bullseye-slim",
        name=f"sandbox-{sid}",
        command=["bash", "-lc", fallback_cmd],
        working_dir="/workspace",
        user="0",
        network=DEFAULT_NETWORK,
        labels=labels,
        environment=container_env,
        volumes={
            volume_name: {"bind": "/workspace", "mode": "rw"},
            "/config": {"bind": "/config", "mode": "ro"},  # Mount config dir read-only for API keys
        },
        security_opt=SECURITY_OPTS,
        mem_limit=MEM_LIMIT,
        nano_cpus=int(CPU_LIMIT * 1e9),
        read_only=False,
        tty=True,
    )

    # Get API key for the model if available
    api_key_env = {}
    project_config_path = workspace / "project.config.json"
    if project_config_path.exists():
        try:
            project_config = json.loads(project_config_path.read_text(encoding="utf-8"))
            model = project_config.get("model", "gemini")
            
            # Map model to environment variable
            model_env_map = {
                "claude": "CLAUDE_API_KEY",
                "codex": "OPENAI_API_KEY", 
                "gemini": "GEMINI_API_KEY"
            }
            
            env_var = model_env_map.get(model, "GEMINI_API_KEY")
            
            # Try to get API key from mounted config
            config_file = Path("/config/api_keys.json")
            if config_file.exists():
                import base64
                from cryptography.fernet import Fernet
                
                # Get encryption key
                key_file = Path("/config/.encryption_key")
                if key_file.exists():
                    encryption_key = key_file.read_bytes()
                    f = Fernet(encryption_key)
                    
                    # Load and decrypt keys
                    encrypted_keys = json.loads(config_file.read_text(encoding="utf-8"))
                    if model in encrypted_keys and encrypted_keys[model]:
                        try:
                            decrypted_key = f.decrypt(encrypted_keys[model].encode()).decode()
                            api_key_env[env_var] = decrypted_key
                            log(f"create_sandbox:api_key_loaded for {model}")
                        except Exception as e:
                            log(f"create_sandbox:api_key_decrypt_error {e}")
        except Exception as e:
            log(f"create_sandbox:config_load_error {e}")
    
    # Build a tar archive containing template files, the agent launcher, and the entry script
    tar_bytes = io.BytesIO()
    with tarfile.open(fileobj=tar_bytes, mode="w") as tar:
        # add template files
        for path in template_dir.rglob("*"):
            rel = path.relative_to(template_dir)
            ti = tarfile.TarInfo(name=str(rel))
            if path.is_dir():
                ti.type = tarfile.DIRTYPE
                ti.mode = 0o755
                tar.addfile(ti)
            else:
                data = path.read_bytes()
                ti.size = len(data)
                ti.mode = 0o644
                tar.addfile(ti, io.BytesIO(data))
        # add entry script
        es = entry_script.encode("utf-8")
        ti = tarfile.TarInfo(name=".sandbox-entry.sh")
        ti.size = len(es)
        ti.mode = 0o755
        tar.addfile(ti, io.BytesIO(es))
        # add minimal agent launcher (node)
        agent_js = (
            "const fs=require('fs');const {exec} = require('child_process');\n" 
            "function println(x){process.stdout.write(String(x)+'\\n');}\n"
            "let model='unknown';try{const cfg=JSON.parse(fs.readFileSync('/workspace/project.config.json','utf-8'));model=cfg.model||'unknown';}catch{}\n"
            "println('[agent] model='+model);println('[agent] tools: read <p>, write <p> <text>, run <cmd>');\n"
            "const rl=require('readline').createInterface({input:process.stdin,output:process.stdout,terminal:false});\n"
            "rl.on('line', (line)=>{line=line.trim(); if(!line)return; if(line.startsWith('read ')){const p=line.slice(5); try{println(fs.readFileSync('/workspace/'+p,'utf-8'));}catch(e){println('[error] '+e.message);} }"
            "else if(line.startsWith('write ')){const m=line.match(/^write\\s+([^\\s]+)\\s+([\u0000-\uFFFF]*)$/); if(m){try{fs.mkdirSync(require('path').dirname('/workspace/'+m[1]),{recursive:true}); fs.writeFileSync('/workspace/'+m[1], m[2]); println('[ok] wrote');}catch(e){println('[error] '+e.message);} } else {println('[error] usage: write <path> <text>');}}"
            "else if(line.startsWith('run ')){exec(line.slice(4), {cwd:'/workspace'}, (err, stdout, stderr)=>{ if(err) println('[error] '+err.message); if(stdout) process.stdout.write(stdout); if(stderr) process.stdout.write(stderr); });}"
            "else {println('echo: '+line);} });\n"
        )
        ti = tarfile.TarInfo(name=".agent/launcher.js")
        ti.size = len(agent_js.encode('utf-8'))
        ti.mode = 0o755
        tar.addfile(ti, io.BytesIO(agent_js.encode('utf-8')))
    tar_bytes.seek(0)

    # Upload to container workspace before start
    container.put_archive("/workspace", tar_bytes.getvalue())

    # Start container now that files exist
    container.start()

    # Wait for dev server to respond on the declared port (up to 180s)
    target = f"http://sandbox-{sid}:{port}/"
    deadline = time.time() + 180
    ready = False
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(target, timeout=3) as resp:
                if resp.status < 500:
                    ready = True
                    break
        except Exception:
            pass
        time.sleep(2)

    log(f"create_sandbox:{'ready' if ready else 'timeout'} container_id={container.id[:12]} url={target}")
    if not ready:
        try:
            (workspace / "session.log").open("a", encoding="utf-8").write("[orchestrator] timeout waiting for dev server\n")
        except Exception:
            pass

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


@app.websocket("/agent/{sandbox_id}")
async def agent_ws(websocket: WebSocket, sandbox_id: str) -> None:
    """Bridge a PTY inside the sandbox container to the websocket."""
    await websocket.accept()
    import threading
    from docker import APIClient

    c = _get_container(sandbox_id)
    api = APIClient(base_url=DOCKER.api.base_url)
    # Start the node agent launcher
    exec_id = api.exec_create(container=c.id, cmd=["bash", "-lc", "node /workspace/.agent/launcher.js"], tty=True, stdin=True)["Id"]
    sock = api.exec_start(exec_id, tty=True, stream=True, socket=True)

    stop = threading.Event()

    def pump_output() -> None:
        try:
            while not stop.is_set():
                data = sock.recv(1024)
                if not data:
                    break
                try:
                    awaitable = websocket.send_text(data.decode(errors="ignore"))
                except Exception:
                    break
                try:
                    import asyncio
                    asyncio.get_event_loop().create_task(awaitable)
                except Exception:
                    pass
        except Exception:
            pass

    t = threading.Thread(target=pump_output, daemon=True)
    t.start()

    try:
        while True:
            msg = await websocket.receive_text()
            if not msg.endswith("\n"):
                msg = msg + "\n"
            try:
                sock.send(msg.encode())
            except Exception:
                break
    except Exception:
        pass
    finally:
        stop.set()
        try:
            sock.close()
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass

@app.post("/agent/{sandbox_id}/echo")
def agent_echo(sandbox_id: str, input: str = Body(..., embed=True)) -> dict:
    # Stub echo endpoint for environments where websockets are blocked
    return {"out": f"echo: {input}"}

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
