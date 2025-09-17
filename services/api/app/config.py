"""
Configuration management for API keys and settings
"""
import os
import json
from pathlib import Path
from typing import Dict, Optional
import httpx
from cryptography.fernet import Fernet

# Configuration storage path
CONFIG_DIR = Path("/config")
CONFIG_FILE = CONFIG_DIR / "api_keys.json"
ENCRYPTION_KEY_FILE = CONFIG_DIR / ".encryption_key"

def get_encryption_key() -> bytes:
    """Get or create encryption key for API keys"""
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    if ENCRYPTION_KEY_FILE.exists():
        return ENCRYPTION_KEY_FILE.read_bytes()
    else:
        key = Fernet.generate_key()
        ENCRYPTION_KEY_FILE.write_bytes(key)
        ENCRYPTION_KEY_FILE.chmod(0o600)  # Restrict access
        return key

def encrypt_value(value: str) -> str:
    """Encrypt a string value"""
    if not value:
        return ""
    f = Fernet(get_encryption_key())
    return f.encrypt(value.encode()).decode()

def decrypt_value(encrypted: str) -> str:
    """Decrypt a string value"""
    if not encrypted:
        return ""
    try:
        f = Fernet(get_encryption_key())
        return f.decrypt(encrypted.encode()).decode()
    except Exception:
        return ""

def save_api_keys(keys: Dict[str, str]) -> None:
    """Save API keys to encrypted storage"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    encrypted_keys = {
        "claude": encrypt_value(keys.get("claude", "")),
        "codex": encrypt_value(keys.get("codex", "")),
        "gemini": encrypt_value(keys.get("gemini", ""))
    }
    
    CONFIG_FILE.write_text(json.dumps(encrypted_keys, indent=2), encoding="utf-8")

def load_api_keys() -> Dict[str, str]:
    """Load API keys from encrypted storage"""
    if not CONFIG_FILE.exists():
        return {"claude": "", "codex": "", "gemini": ""}
    
    try:
        encrypted_keys = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        return {
            "claude": decrypt_value(encrypted_keys.get("claude", "")),
            "codex": decrypt_value(encrypted_keys.get("codex", "")),
            "gemini": decrypt_value(encrypted_keys.get("gemini", ""))
        }
    except Exception:
        return {"claude": "", "codex": "", "gemini": ""}

def validate_claude_key(api_key: str) -> bool:
    """Validate Claude API key by making a test request"""
    if not api_key or not api_key.startswith("sk-ant-"):
        return False
    
    try:
        # Test with a minimal request to Claude API
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": "claude-3-haiku-20240307",
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "Hi"}]
            },
            timeout=5
        )
        # 401 means invalid key, 200 means valid
        return response.status_code != 401
    except Exception:
        # If we can't validate, assume it might be valid
        return True

def validate_openai_key(api_key: str) -> bool:
    """Validate OpenAI API key by making a test request"""
    if not api_key or not api_key.startswith("sk-"):
        return False
    
    try:
        # Test with a minimal request to OpenAI API
        response = httpx.get(
            "https://api.openai.com/v1/models",
            headers={
                "Authorization": f"Bearer {api_key}"
            },
            timeout=5
        )
        # 401 means invalid key, 200 means valid
        return response.status_code != 401
    except Exception:
        # If we can't validate, assume it might be valid
        return True

def validate_gemini_key(api_key: str) -> bool:
    """Validate Gemini API key by making a test request"""
    if not api_key:
        return False
    
    try:
        # Test with a minimal request to Gemini API
        response = httpx.get(
            f"https://generativelanguage.googleapis.com/v1/models?key={api_key}",
            timeout=5
        )
        # 403/401 means invalid key, 200 means valid
        return response.status_code not in [401, 403]
    except Exception:
        # If we can't validate, assume it might be valid
        return True

def validate_api_keys(keys: Dict[str, str]) -> Dict[str, bool]:
    """Validate all provided API keys"""
    validation = {}
    
    if keys.get("claude"):
        validation["claude"] = validate_claude_key(keys["claude"])
    
    if keys.get("codex"):
        validation["codex"] = validate_openai_key(keys["codex"])
    
    if keys.get("gemini"):
        validation["gemini"] = validate_gemini_key(keys["gemini"])
    
    return validation

def get_api_key_for_model(model: str) -> Optional[str]:
    """Get the API key for a specific model"""
    keys = load_api_keys()
    
    model_map = {
        "claude": "claude",
        "Claude Code": "claude",
        "codex": "codex",
        "Codex (GPT-5)": "codex",
        "gemini": "gemini",
        "Gemini CLI": "gemini"
    }
    
    key_name = model_map.get(model)
    if key_name:
        return keys.get(key_name)
    
    return None

def check_model_key_configured(model: str) -> bool:
    """Check if API key is configured for a model"""
    key = get_api_key_for_model(model)
    return bool(key)
