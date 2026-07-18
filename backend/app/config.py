from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    asr_model_name: str = "tarteel-ai/whisper-base-ar-quran"
    asr_device: int = -1
    quran_api_base_url: str = "https://api.quran.com/api/v4"
    # ffmpeg binary used to decode uploads; override with an absolute path
    # when ffmpeg is not on the server's PATH.
    ffmpeg_path: str = "ffmpeg"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    # Skip HuggingFace network checks at startup; requires a warm model cache.
    hf_hub_offline: bool = False
    max_upload_bytes: int = 10 * 1024 * 1024
    # Comma-separated origins for CORS; "*" is fine while there is no web build.
    cors_allow_origins: str = "*"


settings = Settings()
