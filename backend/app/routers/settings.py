import os
import re
from pathlib import Path
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings
from app.services.llm_orchestrator import LLMOrchestrator

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingsUpdateRequest(BaseModel):
    openai_key: Optional[str] = None
    gemini_key: Optional[str] = None
    provider: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    openai_model: Optional[str] = None
    gemini_model: Optional[str] = None

class TestLLMRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    model: Optional[str] = None

def mask_key(key: str) -> str:
    if not key or len(key.strip()) < 8:
        return ""
    key = key.strip()
    return f"{key[:4]}...{key[-4:]}"

@router.get("")
def get_settings():
    gemini_key = getattr(settings, "effective_gemini_key", settings.GEMINI_API_KEY).strip()
    openai_key = (settings.OPENAI_API_KEY or "").strip()
    has_gemini = bool(gemini_key)
    has_openai = bool(openai_key)

    return {
        "provider": settings.DEFAULT_LLM_PROVIDER,
        "openai_configured": has_openai,
        "gemini_configured": has_gemini,
        "openai_from_env": has_openai,
        "gemini_from_env": has_gemini,
        "openai_masked": mask_key(openai_key),
        "gemini_masked": mask_key(gemini_key),
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "openai_model": settings.OPENAI_MODEL,
        "gemini_model": settings.GEMINI_MODEL,
        "environment": settings.ENVIRONMENT
    }

@router.post("")
def update_settings(payload: SettingsUpdateRequest):
    # Update running memory
    if payload.openai_key is not None:
        settings.OPENAI_API_KEY = payload.openai_key.strip()
    if payload.gemini_key is not None:
        val = payload.gemini_key.strip()
        settings.GEMINI_API_KEY = val
        settings.GOOGLE_API_KEY = val
    if payload.ollama_base_url is not None and payload.ollama_base_url.strip():
        settings.OLLAMA_BASE_URL = payload.ollama_base_url.strip()
    if payload.ollama_model is not None and payload.ollama_model.strip():
        settings.OLLAMA_MODEL = payload.ollama_model.strip()
    if payload.openai_model is not None and payload.openai_model.strip():
        settings.OPENAI_MODEL = payload.openai_model.strip()
    if payload.gemini_model is not None and payload.gemini_model.strip():
        settings.GEMINI_MODEL = payload.gemini_model.strip()
    if payload.provider is not None and payload.provider.strip():
        settings.DEFAULT_LLM_PROVIDER = payload.provider.strip()

    # Persist to backend/.env
    env_path = settings.BASE_DIR / ".env"
    existing_content = ""
    if env_path.exists():
        try:
            existing_content = env_path.read_text(encoding="utf-8")
        except Exception:
            existing_content = ""

    # Helper to update or append env variable
    def set_env_val(content: str, key: str, val: str) -> str:
        pattern = rf"^{key}=.*$"
        if re.search(pattern, content, flags=re.MULTILINE):
            return re.sub(pattern, f"{key}={val}", content, flags=re.MULTILINE)
        else:
            if content and not content.endswith("\n"):
                content += "\n"
            return content + f"{key}={val}\n"

    new_content = existing_content
    if payload.openai_key is not None:
        new_content = set_env_val(new_content, "OPENAI_API_KEY", payload.openai_key.strip())
    if payload.gemini_key is not None:
        val = payload.gemini_key.strip()
        new_content = set_env_val(new_content, "GEMINI_API_KEY", val)
        new_content = set_env_val(new_content, "GOOGLE_API_KEY", val)
    if payload.ollama_base_url is not None:
        new_content = set_env_val(new_content, "OLLAMA_BASE_URL", payload.ollama_base_url.strip())
    if payload.ollama_model is not None:
        new_content = set_env_val(new_content, "OLLAMA_MODEL", payload.ollama_model.strip())
    if payload.openai_model is not None:
        new_content = set_env_val(new_content, "OPENAI_MODEL", payload.openai_model.strip())
    if payload.gemini_model is not None:
        new_content = set_env_val(new_content, "GEMINI_MODEL", payload.gemini_model.strip())
    if payload.provider is not None:
        new_content = set_env_val(new_content, "DEFAULT_LLM_PROVIDER", payload.provider.strip())

    try:
        env_path.write_text(new_content, encoding="utf-8")
    except Exception:
        pass

    gemini_key = getattr(settings, "effective_gemini_key", settings.GEMINI_API_KEY).strip()
    openai_key = (settings.OPENAI_API_KEY or "").strip()
    has_gemini = bool(gemini_key)
    has_openai = bool(openai_key)

    return {
        "status": "success",
        "message": "Settings updated successfully",
        "provider": settings.DEFAULT_LLM_PROVIDER,
        "openai_configured": has_openai,
        "gemini_configured": has_gemini,
        "openai_from_env": has_openai,
        "gemini_from_env": has_gemini,
        "openai_masked": mask_key(openai_key),
        "gemini_masked": mask_key(gemini_key),
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "openai_model": settings.OPENAI_MODEL,
        "gemini_model": settings.GEMINI_MODEL
    }

@router.post("/test-llm")
async def test_llm(payload: TestLLMRequest):
    """Diagnostically tests an LLM provider connection (e.g. OpenAI or Gemini) and returns latency + validation status."""
    return await LLMOrchestrator.test_provider_connection(
        provider=payload.provider,
        api_key=payload.api_key,
        model=payload.model
    )

@router.get("/network-info")
def get_network_info():
    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            local_ip = "127.0.0.1"

    hostname = socket.gethostname()
    return {
        "local_ip": local_ip,
        "port": 5173,
        "mobile_url": f"http://{local_ip}:5173",
        "hostname": hostname
    }
