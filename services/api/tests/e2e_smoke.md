# E2E Smoke (manual steps)

1. POST /api/projects { name, stack, purpose, model }
2. POST /api/projects/:id/sandboxes { stack }
3. Open preview at https://preview-<id>.sandboxes.devbox.local and expect 200.
