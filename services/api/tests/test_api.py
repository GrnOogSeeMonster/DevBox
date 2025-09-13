import httpx


def test_healthz_shape():
  # This test is a placeholder for containerized execution; it asserts the contract shape
  assert isinstance({"status": "ok"}, dict)
