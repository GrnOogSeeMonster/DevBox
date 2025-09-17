from __future__ import annotations

import argparse
import json
import os
import sys
import time
from typing import Any

import httpx


API_URL = os.getenv("API_URL", os.getenv("API_INTERNAL_URL", "http://api:8000/api")).rstrip("/")


def _post(client: httpx.Client, path: str, json_body: dict[str, Any]) -> dict[str, Any]:
    r = client.post(f"{API_URL}{path}", json=json_body)
    r.raise_for_status()
    return r.json()


def cmd_new(stack: str, name: str, model: str, purpose: str) -> int:
    with httpx.Client(timeout=None) as client:
        project = _post(
            client,
            "/projects",
            {"name": name, "stack": stack, "model": model, "purpose": purpose},
        )
        sandbox = _post(
            client,
            f"/projects/{project['id']}/sandboxes",
            {"stack": stack},
        )

    out = {
        "project_id": project["id"],
        "sandbox_id": sandbox["id"],
        "preview_url": f"/api/preview/{sandbox['id']}",
    }
    print(json.dumps(out))
    return 0


def cmd_build(stack: str, name: str, model: str, purpose: str) -> int:
    # alias of new for now
    return cmd_new(stack=stack, name=name, model=model, purpose=purpose)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="devbox-cli", description="DevBox CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_new = sub.add_parser("new", help="Create project and sandbox")
    p_new.add_argument("--stack", required=True)
    p_new.add_argument("--name", required=True)
    p_new.add_argument("--model", default="gemini")
    p_new.add_argument("--purpose", default="modern-web")

    p_build = sub.add_parser("build", help="Build and run a new app (alias of new)")
    p_build.add_argument("--stack", required=True)
    p_build.add_argument("--name", required=True)
    p_build.add_argument("--model", default="gemini")
    p_build.add_argument("--purpose", default="modern-web")

    args = parser.parse_args(argv)

    if args.cmd == "new":
        return cmd_new(args.stack, args.name, args.model, args.purpose)
    if args.cmd == "build":
        return cmd_build(args.stack, args.name, args.model, args.purpose)
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))


