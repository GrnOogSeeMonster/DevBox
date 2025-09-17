from __future__ import annotations

import uuid
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    stack: str
    purpose: str
    model: str


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    stack: str
    purpose: str
    model: str


class SandboxCreate(BaseModel):
    stack: str


class SandboxOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    stack: str
    status: str
    preview_host: str | None = None
