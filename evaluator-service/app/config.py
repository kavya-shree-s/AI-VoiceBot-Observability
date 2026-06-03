import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Process configuration read from the environment."""

    def __init__(self) -> None:
        self.prodloop_api_key: str = os.environ.get("PRODLOOP_API_KEY", "")
        # Max accepted upload size in bytes (default 50 MB).
        self.max_audio_bytes: int = int(
            os.environ.get("MAX_AUDIO_BYTES", str(50 * 1024 * 1024))
        )
        # SDK request timeout (seconds). evaluate_call can be slow.
        self.evaluate_timeout_seconds: int = int(
            os.environ.get("PRODLOOP_TIMEOUT_SECONDS", "1800")
        )
        # Comma-separated origins allowed to call this service directly.
        self.allowed_origins: list[str] = [
            o.strip()
            for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")
            if o.strip()
        ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
