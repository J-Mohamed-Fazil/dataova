import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

# Explicitly load .env from both backend/ and parent workspace root
load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(BASE_DIR.parent / ".env", override=False)

class Settings(BaseSettings):
    PROJECT_NAME: str = "DATOVA AI"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    AUTH_SECRET_KEY: str = os.getenv("AUTH_SECRET_KEY", "datova-quantum-hyper-secure-secret-key-991823")
    AUTH_TOKEN_EXPIRE_HOURS: int = 72
    
    # Storage
    BASE_DIR: Path = BASE_DIR
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    SAMPLES_DIR: Path = BASE_DIR / "app" / "data" / "samples"
    EXPORTS_DIR: Path = BASE_DIR / "exports"
    MAX_FILE_SIZE_MB: int = 50
    
    # Database (PostgreSQL ready, SQLite default for zero-setup local execution)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'datova.db'}")
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # AI Providers
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    OPENAI_MODEL: str = "gpt-4o"
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-latest"
    DEFAULT_LLM_PROVIDER: str = "auto" # "openai", "gemini", "deepseek", "anthropic", "ollama", "auto", or "offline_deterministic"

    model_config = SettingsConfigDict(
        env_file=[str(BASE_DIR / ".env"), str(BASE_DIR.parent / ".env")],
        extra="allow"
    )

    def model_post_init(self, __context: Any) -> None:
        # Fall back to os.getenv if pydantic didn't populate them
        if not self.OPENAI_API_KEY:
            self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        if not self.GEMINI_API_KEY:
            self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        if not self.GOOGLE_API_KEY:
            self.GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "") or self.GEMINI_API_KEY
        if not self.DEEPSEEK_API_KEY:
            self.DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
        if not self.ANTHROPIC_API_KEY:
            self.ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
        
        # Synchronize GEMINI_API_KEY and GOOGLE_API_KEY so either variable name works
        if not self.GEMINI_API_KEY and self.GOOGLE_API_KEY:
            self.GEMINI_API_KEY = self.GOOGLE_API_KEY
        elif not self.GOOGLE_API_KEY and self.GEMINI_API_KEY:
            self.GOOGLE_API_KEY = self.GEMINI_API_KEY

    @property
    def effective_gemini_key(self) -> str:
        key = self.GEMINI_API_KEY or self.GOOGLE_API_KEY or os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
        return (key or "").strip()

settings = Settings()

# Ensure required directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
settings.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

