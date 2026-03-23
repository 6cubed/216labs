from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./data/anchor.db"
    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_days: int = 30
    radius_meters: int = 5000

    class Config:
        env_prefix = "ANCHOR_"


settings = Settings()
