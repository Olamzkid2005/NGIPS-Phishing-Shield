"""
NGIPS Phishing Shield - Main FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.log_config import setup_logging
from app.ml.models import load_models, validate_models_on_startup, get_model_loader
from app.api.v1.endpoints import api_router

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("Starting NGIPS Phishing Shield API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS Origins: {settings.CORS_ORIGINS}")
    
    # Load ML models
    logger.info("Loading ML models...")
    try:
        success = load_models()
        if not success:
            raise RuntimeError("Failed to load ML models")
        
        # Validate models are functional
        validate_models_on_startup()
        logger.info("✓ ML models loaded and validated successfully")
        
    except Exception as e:
        logger.error(f"✗ Failed to initialize ML models: {e}")
        raise RuntimeError(f"ML model initialization failed: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down NGIPS Phishing Shield API...")


# Create FastAPI application
app = FastAPI(
    title="NGIPS Phishing Shield API",
    description="Next-Generation Intrusion Prevention System for phishing detection",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/")
async def root():
    """
    Root endpoint - API information
    """
    return {
        "name": "NGIPS Phishing Shield API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint with model status
    """
    model_loader = get_model_loader()
    system_info = model_loader.get_system_info()
    
    return {
        "status": "healthy",
        "service": "ngips-phishing-shield",
        "version": "1.0.0",
        "models": {
            "status": system_info["status"],
            "count": system_info["model_count"],
            "version": system_info["model_version"],
            "available": system_info.get("best_models", [])
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
