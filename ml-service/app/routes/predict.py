import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.predictor import predict_url
from app.utils.preprocessor import validate_url

logger = logging.getLogger(__name__)

router = APIRouter()


class PredictRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


class PredictResponse(BaseModel):
    is_phishing: bool
    confidence: float
    model_scores: dict[str, float]
    processing_time_ms: float


@router.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    is_valid, message = validate_url(request.url)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    start = time.perf_counter()
    try:
        result = predict_url(request.url.strip())
    except RuntimeError as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected prediction error")
        raise HTTPException(status_code=500, detail="Internal prediction error")

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

    return PredictResponse(
        is_phishing=result["is_phishing"],
        confidence=result["confidence"],
        model_scores=result["model_scores"],
        processing_time_ms=elapsed_ms,
    )
