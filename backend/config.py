from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    """Central application settings loaded from backend/.env."""

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "classpilot_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    AI_BASE_URL: str = "http://localhost:11434/api"
    AI_MODEL: str = "qwen2.5:7b"
    AI_TIMEOUT_SECONDS: int = 120

    FRONTEND_URL: str = "http://localhost:5173"
    APP_NAME: str = "ClassPilot API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SUBMISSION_UPLOAD_DIR: Path = BACKEND_DIR / "private_uploads"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def database_url(self) -> URL:
        """Build a PostgreSQL URL safely, including special password characters."""
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.DB_USER,
            password=self.DB_PASSWORD,
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        )

    @property
    def cors_origins(self) -> list[str]:
        """Return the allowed frontend origins."""
        origins = [
            self.FRONTEND_URL,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        return list(dict.fromkeys(origin.rstrip("/") for origin in origins))


settings = Settings()
