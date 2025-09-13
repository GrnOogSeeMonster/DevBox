from __future__ import annotations

import os
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
from sqlmodel import Session

APP_ENV = os.getenv("ENV", "dev")
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "https://studio.devbox.local,https://localhost,http://localhost").split(",")
WORKSPACES_ROOT = Path("/workspaces")
ORCH_URL = os.getenv("ORCHESTRATOR_URL", "http://orchestrator:8080")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-local-dotenv")

app = FastAPI(title="DevBox API", version="0.1.0")

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

    return ProjectOut(id=project.id, name=project.name, stack=project.stack, purpose=project.purpose, model=project.model)


@app.post("/api/projects/{project_id}/sandboxes", response_model=SandboxOut)
def create_sandbox(project_id: uuid.UUID, body: SandboxCreate, session: Session = Depends(get_session)) -> SandboxOut:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    sandbox = Sandbox(project_id=project_id, stack=body.stack, status="creating")
    session.add(sandbox)
    session.commit()
    session.refresh(sandbox)

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

    sandbox.status = data.get("status", "running")
    sandbox.container_id = data.get("container_id")
    sandbox.preview_host = data.get("preview_host")
    session.add(sandbox)
    session.commit()
    session.refresh(sandbox)

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


@app.post("/api/import")
def import_project(project_id: uuid.UUID, archive: UploadFile = File(...)) -> dict:
    base = WORKSPACES_ROOT / str(project_id)
    base.mkdir(parents=True, exist_ok=True)
    data = archive.file.read()
    with zipfile.ZipFile(BytesIO(data)) as zf:
        zf.extractall(base)
    return {"status": "ok"}
