from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    asr_model_name: str = "tarteel-ai/whisper-base-ar-quran"
    asr_device: int = -1


settings = Settings()
