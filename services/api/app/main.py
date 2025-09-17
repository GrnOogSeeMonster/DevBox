from __future__ import annotations

import os
import json
from datetime import datetime
import uuid
from io import BytesIO
from pathlib import Path
import shutil
import zipfile
import time

import httpx
import jwt
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from passlib.hash import bcrypt
from sqlmodel import select

from .database import init_db, get_session
from .models import Project, Sandbox, User
from .schemas import ProjectCreate, ProjectOut, SandboxCreate, SandboxOut
from .config import (
    save_api_keys, 
    load_api_keys, 
    validate_api_keys,
    check_model_key_configured,
    get_api_key_for_model
)
from sqlmodel import Session

APP_ENV = os.getenv("ENV", "dev")
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "https://studio.devbox.local,https://localhost,http://localhost").split(",")
WORKSPACES_ROOT = Path("/workspaces")
ORCH_URL = os.getenv("ORCHESTRATOR_URL", "http://orchestrator:8080")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-local-dotenv")

app = FastAPI(title="DevBox API", version="0.1.0")
def _append_session_log(project_id: uuid.UUID, message: str) -> None:
    try:
        ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        line = f"[{ts}] {message}\n"
        base = WORKSPACES_ROOT / str(project_id)
        base.mkdir(parents=True, exist_ok=True)
        (base / "session.log").open("a", encoding="utf-8").write(line)
    except Exception:
        # Best-effort logging; don't fail the request
        pass


def _bootstrap_factory(project: Project, sandbox: Sandbox, project_dir: Path) -> None:
    """Bootstrap the Agentic Application Factory configuration"""
    factory_dir = project_dir / ".factory"
    factory_dir.mkdir(parents=True, exist_ok=True)
    
    # Load pattern map from root .factory if it exists
    pattern_map_path = Path("/app/.factory/pattern-map.json")
    if not pattern_map_path.exists():
        # Try workspace root
        pattern_map_path = Path(".factory/pattern-map.json")
    
    if pattern_map_path.exists():
        pattern_map = json.loads(pattern_map_path.read_text(encoding="utf-8"))
    else:
        # Minimal fallback
        pattern_map = {
            "cli_binding": {
                "Gemini CLI": {
                    "promptFile": "GEMINI.md",
                    "launch": "gemini",
                    "env": "GEMINI_API_KEY",
                    "description": "Open-source AI agent"
                }
            }
        }
    
    # Map model names
    model_map = {
        "claude": "Claude Code",
        "codex": "Codex (GPT-5)", 
        "gemini": "Gemini CLI"
    }
    model_name = model_map.get(project.model, "Gemini CLI")
    
    # Get CLI binding
    cli_binding = pattern_map.get("cli_binding", {}).get(model_name, pattern_map["cli_binding"].get("Gemini CLI"))
    
    # Create session metadata
    session_data = {
        "model": model_name,
        "stack": project.stack,
        "purpose": project.purpose,
        "projectName": project.name,
        "created_at": datetime.utcnow().isoformat()
    }
    (factory_dir / "session.json").write_text(json.dumps(session_data, indent=2), encoding="utf-8")
    
    # Copy algorithm if available
    algorithm_src = Path("/app/.factory/algorithm.md")
    if not algorithm_src.exists():
        algorithm_src = Path(".factory/algorithm.md")
    
    if algorithm_src.exists():
        (factory_dir / "algorithm.md").write_bytes(algorithm_src.read_bytes())
    
    # Generate prompt file
    prompt_content = f"""# {cli_binding['promptFile'].replace('.md', '')} Agent Configuration

## Agentic Application Factory

Follow: **Clarify → Plan → Retrieve → Scaffold → Implement → Test → Refine → Finalize**

### Principles
- **KISS**: Keep It Simple
- **DRY**: Don't Repeat Yourself
- **YAGNI**: You Aren't Gonna Need It
- **Security**: No hardcoded secrets

## Stack: {project.stack}
## Purpose: {project.purpose}

## Environment
- CLI: {cli_binding['launch']}
- Required: {cli_binding['env']}
- Description: {cli_binding['description']}

## DevBox Context
- Live preview enabled
- Hot reload active
- Workspace: /workspace
"""
    
    (factory_dir / cli_binding["promptFile"]).write_text(prompt_content, encoding="utf-8")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)
    init_db()


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.get("/metrics")
def metrics() -> str:
    return "# HELP devbox_up 1 if the API is up\n# TYPE devbox_up gauge\ndevbox_up 1\n"


# --- Auth (local, minimal) ---
@app.post("/api/auth/register")
def register(first_name: str, last_name: str, username: str, email: str, password: str, session: Session = Depends(get_session)):
    email = email.strip().lower()
    username = username.strip().lower()
    if session.exec(select(User).where(User.email == email)).first() or session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(status_code=400, detail="User exists")
    user = User(email=email, username=username, password_hash=bcrypt.hash(password))
    session.add(user)
    session.commit()
    token = jwt.encode({"sub": str(user.id), "iat": int(time.time())}, JWT_SECRET, algorithm="HS256")
    return {"token": token, "user": {"id": str(user.id), "email": user.email, "username": user.username}}


@app.get("/api/config/keys")
def get_api_keys():
    """Get configured API keys (masked)"""
    keys = load_api_keys()
    # Mask the keys for security
    masked = {}
    for key, value in keys.items():
        if value:
            if len(value) > 8:
                masked[key] = value[:4] + "****" + value[-4:]
            else:
                masked[key] = "********"
        else:
            masked[key] = ""
    return masked


@app.post("/api/config/keys")
def set_api_keys(keys: dict):
    """Save API keys and validate them"""
    # Clean the input
    clean_keys = {
        "claude": keys.get("claude", "").strip(),
        "codex": keys.get("codex", "").strip(),
        "gemini": keys.get("gemini", "").strip()
    }
    
    # Save the keys
    save_api_keys(clean_keys)
    
    # Validate the keys
    validation = validate_api_keys(clean_keys)
    
    return {
        "status": "saved",
        "validation": validation
    }


@app.post("/api/config/validate-model")
def validate_model_key(model: str):
    """Check if a model has a valid API key configured"""
    has_key = check_model_key_configured(model)
    
    if not has_key:
        return {
            "valid": False,
            "message": f"No API key configured for {model}"
        }
    
    # Get and validate the specific key
    key = get_api_key_for_model(model)
    if key:
        # Normalize model to internal key id expected by validate_api_keys
        model_map = {
            "claude": "claude",
            "claude code": "claude",
            "codex": "codex",
            "codex (gpt-5)": "codex",
            "gemini": "gemini",
            "gemini cli": "gemini",
        }
        normalized = model_map.get(model.strip().lower(), "")
        payload = {normalized: key} if normalized else {"codex": key}
        validation = validate_api_keys(payload)
        is_valid = validation.get(normalized, False)
        
        return {
            "valid": is_valid,
            "message": "API key is valid" if is_valid else "API key validation failed"
        }
    
    return {
        "valid": False,
        "message": "Unable to validate API key"
    }


@app.post("/api/auth/login")
def login(username_or_email: str, password: str, session: Session = Depends(get_session)):
    key = username_or_email.strip().lower()
    user = session.exec(select(User).where((User.email == key) | (User.username == key))).first()
    if not user or not bcrypt.verify(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode({"sub": str(user.id), "iat": int(time.time())}, JWT_SECRET, algorithm="HS256")
    return {"token": token, "user": {"id": str(user.id), "email": user.email, "username": user.username}}


@app.post("/api/projects", response_model=ProjectOut)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> ProjectOut:
    _append_session_log(uuid.UUID(int=0), f"API:create_project:start name={payload.name} stack={payload.stack}")
    project = Project(name=payload.name, stack=payload.stack, purpose=payload.purpose, model=payload.model)
    session.add(project)
    session.commit()
    session.refresh(project)

    project_dir = WORKSPACES_ROOT / str(project.id)
    project_dir.mkdir(parents=True, exist_ok=True)

    (project_dir / "project.config.json").write_text(
        (
            "{\n"
            f"  \"model\": \"{payload.model}\",\n"
            f"  \"stack\": \"{payload.stack}\",\n"
            f"  \"purpose\": \"{payload.purpose}\"\n"
            "}\n"
        ),
        encoding="utf-8",
    )

    (project_dir / "SANDBOX_CONTEXT.md").write_text(
        """
# SANDBOX CONTEXT

You are inside a DevBox sandbox. Keep preview live on the right. Use the chosen stack idioms. Save files under /workspace.

Goals: hot reload, minimal friction, pass smoke tests.
Security: no privileged mode, limited cpu/mem, network off by default.
        """.strip()
        + "\n",
        encoding="utf-8",
    )

    _append_session_log(project.id, "API:create_project:ok")
    return ProjectOut(id=project.id, name=project.name, stack=project.stack, purpose=project.purpose, model=project.model)


@app.post("/api/projects/{project_id}/sandboxes", response_model=SandboxOut)
def create_sandbox(project_id: uuid.UUID, body: SandboxCreate, session: Session = Depends(get_session)) -> SandboxOut:
    _append_session_log(project_id, f"API:create_sandbox:start stack={body.stack}")
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    sandbox = Sandbox(project_id=project_id, stack=body.stack, status="creating")
    session.add(sandbox)
    session.commit()
    session.refresh(sandbox)

    try:
        with httpx.Client(timeout=None) as client:
            r = client.post(
                f"{ORCH_URL}/sandboxes",
                json={
                    "sandbox_id": str(sandbox.id),
                    "project_id": str(project_id),
                    "stack": body.stack,
                },
            )
            r.raise_for_status()
            data = r.json()
    except Exception as ex:
        sandbox.status = "error"
        session.add(sandbox)
        session.commit()
        _append_session_log(project_id, f"API:create_sandbox:error {ex}")
        raise HTTPException(status_code=500, detail=f"Orchestrator error: {ex}")

    sandbox.status = data.get("status", "running")
    sandbox.container_id = data.get("container_id")
    sandbox.preview_host = data.get("preview_host")
    session.add(sandbox)
    session.commit()
    session.refresh(sandbox)

    # Persist deterministic session metadata in workspace
    project_dir = WORKSPACES_ROOT / str(project_id)
    session_json = {
        "project_id": str(project_id),
        "sandbox_id": str(sandbox.id),
        "stack": sandbox.stack,
        "status": sandbox.status,
        "preview_host": sandbox.preview_host,
        "created_at": int(time.time()),
    }
    (project_dir / "session.json").write_text(
        json.dumps(session_json, indent=2), encoding="utf-8"
    )
    
    # Bootstrap the factory configuration
    try:
        _bootstrap_factory(project, sandbox, project_dir)
        _append_session_log(project_id, f"API:bootstrap_factory:ok")
    except Exception as e:
        _append_session_log(project_id, f"API:bootstrap_factory:error {e}")
        # Non-fatal error, continue
    
    _append_session_log(project_id, f"API:create_sandbox:ok sandbox_id={sandbox.id} preview_host={sandbox.preview_host}")

    return SandboxOut(
        id=sandbox.id,
        project_id=sandbox.project_id,
        stack=sandbox.stack,
        status=sandbox.status,
        preview_host=sandbox.preview_host,
    )


@app.post("/api/sandboxes/{sandbox_id}/start")
def start_sandbox(sandbox_id: uuid.UUID, session: Session = Depends(get_session)) -> dict:
    s = session.get(Sandbox, sandbox_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    with httpx.Client() as client:
        r = client.post(f"{ORCH_URL}/sandboxes/{sandbox_id}/start")
        r.raise_for_status()
    s.status = "running"
    session.add(s)
    session.commit()
    return {"status": "running"}


@app.post("/api/sandboxes/{sandbox_id}/stop")
def stop_sandbox(sandbox_id: uuid.UUID, session: Session = Depends(get_session)) -> dict:
    s = session.get(Sandbox, sandbox_id)
    if not s:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    with httpx.Client() as client:
        r = client.post(f"{ORCH_URL}/sandboxes/{sandbox_id}/stop")
        r.raise_for_status()
    s.status = "stopped"
    session.add(s)
    session.commit()
    return {"status": "stopped"}


@app.post("/api/sandboxes/{sandbox_id}/restart")
def restart_sandbox(sandbox_id: uuid.UUID, session: Session = Depends(get_session)) -> dict:
    stop_sandbox(sandbox_id, session)
    start_sandbox(sandbox_id, session)
    return {"status": "running"}


# Files API

@app.get("/api/projects/{project_id}/files")
def list_or_read_files(project_id: uuid.UUID, path: str = Query("/", description="path relative to workspace"), raw: int = 0):
    base = WORKSPACES_ROOT / str(project_id)
    target = (base / path.strip("/ ")).resolve()
    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid path")
    if target.is_dir():
        items = []
        for p in sorted(target.iterdir(), key=lambda x: x.name.lower()):
            items.append({"name": p.name, "path": str(p.relative_to(base)), "type": "dir" if p.is_dir() else "file"})
        return {"type": "dir", "items": items}
    if not target.exists():
        raise HTTPException(status_code=404, detail="Not found")
    if raw:
        return StreamingResponse(open(target, "rb"), media_type="application/octet-stream")
    return {"type": "file", "content": target.read_text(encoding="utf-8", errors="ignore")}


@app.post("/api/projects/{project_id}/files")
def write_files(project_id: uuid.UUID, op: str, path: str, content: str | None = None, new_path: str | None = None):
    base = WORKSPACES_ROOT / str(project_id)
    target = (base / path.strip("/ ")).resolve()
    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid path")
    if op == "write":
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content or "", encoding="utf-8")
        return {"status": "ok"}
    if op == "mkdir":
        target.mkdir(parents=True, exist_ok=True)
        return {"status": "ok"}
    if op == "delete":
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()
        return {"status": "ok"}
    if op == "rename":
        if not new_path:
            raise HTTPException(status_code=400, detail="new_path required")
        new_target = (base / new_path.strip("/ ")).resolve()
        if not str(new_target).startswith(str(base)):
            raise HTTPException(status_code=400, detail="Invalid path")
        new_target.parent.mkdir(parents=True, exist_ok=True)
        target.rename(new_target)
        return {"status": "ok"}
    raise HTTPException(status_code=400, detail="Unsupported op")


@app.get("/api/projects/{project_id}/export")
def export_project(project_id: uuid.UUID):
    base = WORKSPACES_ROOT / str(project_id)
    if not base.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    mem = BytesIO()
    with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in base.rglob("*"):
            if p.is_file():
                zf.write(p, arcname=str(p.relative_to(base)))
    mem.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=project-{project_id}.zip"}
    return StreamingResponse(mem, media_type="application/zip", headers=headers)


@app.get("/api/sandboxes/{sandbox_id}")
async def get_sandbox(sandbox_id: str, session: Session = Depends(get_session)):
    """Get sandbox details"""
    sandbox = session.get(Sandbox, sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    # Determine port from template.json in the workspace for accuracy
    port = 5173
    try:
        tmpl = WORKSPACES_ROOT / str(sandbox.project_id) / "template.json"
        if tmpl.exists():
            data = json.loads(tmpl.read_text(encoding="utf-8"))
            port = int(data.get("port", port))
    except Exception:
        pass

    return {
        "id": sandbox.id,
        "project_id": sandbox.project_id,
        "status": sandbox.status,
        "port": port,
        "container_name": f"sandbox-{sandbox_id}",
    }


@app.get("/api/projects/{project_id}/session-log")
def get_session_log(project_id: uuid.UUID):
    base = WORKSPACES_ROOT / str(project_id)
    log_file = base / "session.log"
    if not log_file.exists():
        return StreamingResponse(iter([b""]), media_type="text/plain")
    return StreamingResponse(open(log_file, "rb"), media_type="text/plain")


@app.post("/api/import")
def import_project(project_id: uuid.UUID, archive: UploadFile = File(...)) -> dict:
    base = WORKSPACES_ROOT / str(project_id)
    base.mkdir(parents=True, exist_ok=True)
    data = archive.file.read()
    with zipfile.ZipFile(BytesIO(data)) as zf:
        zf.extractall(base)
    return {"status": "ok"}
