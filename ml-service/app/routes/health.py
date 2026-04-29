import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.models.loader import get_loaded_models

router = APIRouter()

_startup_time = time.time()


class HealthResponse(BaseModel):
    status: str
    models_loaded: list[str]
    uptime: float
    version: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    models = get_loaded_models()
    return HealthResponse(
        status="healthy" if models else "degraded",
        models_loaded=list(models.keys()),
        uptime=round(time.time() - _startup_time, 2),
        version="1.0.0",
    )
