from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    stack: str
    purpose: str
    model: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Sandbox(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    stack: str
    status: str = Field(default="creating")
    container_id: Optional[str] = None
    preview_host: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
