from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    backend_url: str = "http://localhost:8000"
    port: int = 8001

    model_config = {"env_file": ".env"}


settings = Settings()
