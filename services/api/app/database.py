from __future__ import annotations

import os
import time
import sys
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+psycopg://{os.getenv('POSTGRES_USER','devbox')}:{os.getenv('POSTGRES_PASSWORD','devbox')}@postgres:{os.getenv('POSTGRES_PORT','5432')}/{os.getenv('POSTGRES_DB','devbox')}",
)

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)


def init_db() -> None:
    # Retry for up to ~120 seconds
    for attempt in range(1, 61):
        try:
            SQLModel.metadata.create_all(engine)
            print("DB ready: schema ensured", file=sys.stderr)
            return
        except Exception as ex:
            print(f"DB not ready (attempt {attempt}/60): {ex}", file=sys.stderr)
            time.sleep(2)
    # Final attempt will raise
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)
