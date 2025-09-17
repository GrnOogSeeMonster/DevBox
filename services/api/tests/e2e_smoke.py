from __future__ import annotations

import os
import sys
import time
import uuid

import httpx


API = os.getenv("API_INTERNAL_URL", "http://api:8000/api").rstrip("/")
WEB = os.getenv("WEB_URL", "https://localhost").rstrip("/")


def main() -> int:
    with httpx.Client(verify=False, timeout=60) as client:
        # Create project
        r = client.post(
            f"{API}/projects",
            json={
                "name": "E2E Test App",
                "model": "gemini",
                "stack": "next",
                "purpose": "modern-web",
            },
        )
        r.raise_for_status()
        project = r.json()

        # Create sandbox
        r = client.post(
            f"{API}/projects/{project['id']}/sandboxes",
            json={"stack": "next"},
        )
        r.raise_for_status()
        sandbox = r.json()

        # Probe preview path (give it a bit to boot)
        preview = f"{WEB}/api/preview/{sandbox['id']}"
        print({"project_id": project["id"], "sandbox_id": sandbox["id"], "preview": preview})

        ok = False
        for _ in range(60):
            try:
                rp = client.get(preview)
                if rp.status_code < 500 and rp.text:
                    ok = True
                    break
            except Exception:
                pass
            time.sleep(2)

        if not ok:
            print("Preview did not become ready", file=sys.stderr)
            return 2

    print("E2E OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


