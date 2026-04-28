"""
NGIPS Phishing Shield - Configuration Management
Environment-based configuration using Pydantic Settings
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # API Configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/v1"
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:3001"
    ]
    
    # Database Configuration
    DATABASE_URL: str = "file:./ngips.db"
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text
    
    # ML Model Configuration
    MODEL_DIR: str = "./models"
    MODEL_VERSION: str = "20260416_170709"  # Based on training report timestamp
    
    # Feature Extraction Configuration
    MAX_URL_LENGTH: int = 2048
    
    # Rate Limiting Configuration
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_ENABLED: bool = True
    
    # Cache Configuration
    CACHE_ENABLED: bool = True
    CACHE_TTL_SECONDS: int = 3600  # 1 hour
    
    # Security Configuration
    SECRET_KEY: str = "change-me-in-production"
    
    # Threat Intelligence Configuration
    THREAT_INTEL_ENABLED: bool = False
    PHISHTANK_API_KEY: str = ""
    THREAT_DB_UPDATE_INTERVAL_HOURS: int = 24
    
    # Performance Configuration
    API_TIMEOUT_SECONDS: int = 5


# Create global settings instance
settings = Settings()


# Validation on startup
def validate_settings():
    """
    Validate critical settings on application startup
    """
    errors = []
    
    # Check model directory exists
    if not os.path.exists(settings.MODEL_DIR):
        errors.append(f"Model directory not found: {settings.MODEL_DIR}")
    
    # Check production settings
    if settings.ENVIRONMENT == "production":
        if settings.SECRET_KEY == "change-me-in-production":
            errors.append("SECRET_KEY must be changed in production")
        
        if settings.DEBUG:
            errors.append("DEBUG must be False in production")
    
    if errors:
        raise ValueError(f"Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors))


if __name__ == "__main__":
    # Test configuration loading
    print("Configuration loaded successfully:")
    print(f"  Environment: {settings.ENVIRONMENT}")
    print(f"  API Host: {settings.API_HOST}:{settings.API_PORT}")
    print(f"  Database: {settings.DATABASE_URL}")
    print(f"  Log Level: {settings.LOG_LEVEL}")
    print(f"  Model Version: {settings.MODEL_VERSION}")
    
    try:
        validate_settings()
        print("\n✓ Configuration validation passed")
    except ValueError as e:
        print(f"\n✗ Configuration validation failed:\n{e}")
