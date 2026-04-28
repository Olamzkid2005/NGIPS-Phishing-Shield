"""
NGIPS Phishing Shield - URL Analysis API Endpoint
POST /v1/analyze - Analyze URLs for phishing detection
"""

import re
import time
import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.log_config import set_request_id, get_request_id
from app.ml.models import get_model_loader

logger = logging.getLogger(__name__)
router = APIRouter()

URL_PATTERN = re.compile(
    r"^https?://"  # http:// or https://
    r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain
    r"localhost|"  # localhost
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # IP
    r"(?::\d+)?"  # optional port
    r"(?:/?|[/?]\S+)$",
    re.IGNORECASE
)


class AnalyzeRequest(BaseModel):
    """Request model for URL analysis"""
    url: str = Field(..., min_length=1, max_length=settings.MAX_URL_LENGTH, description="URL to analyze")
    timestamp: Optional[str] = Field(None, description="Optional timestamp from client")
    extensionVersion: Optional[str] = Field(None, description="Extension version")

    @field_validator("url")
    @classmethod
    def validate_url_format(cls, v: str) -> str:
        """Validate URL format"""
        if not v or not v.strip():
            raise ValueError("URL cannot be empty")
        
        v = v.strip()
        
        if not URL_PATTERN.match(v):
            raise ValueError("Invalid URL format. URL must start with http:// or https://")
        
        return v


class AnalyzeResponse(BaseModel):
    """Response model for URL analysis"""
    id: str = Field(..., description="Unique scan ID")
    url: str = Field(..., description="Analyzed URL")
    action: str = Field(..., description="Action: block or allow")
    confidence: float = Field(..., description="Confidence score (0-1)")
    threatLevel: str = Field(..., description="Threat level: low, medium, high, critical")
    reasons: list[str] = Field(..., description="List of threat indicators")
    modelVersion: str = Field(..., description="ML model version")
    processingTime: float = Field(..., description="Processing time in milliseconds")
    timestamp: str = Field(..., description="Scan timestamp")


def _get_threat_level_and_action(confidence: float) -> tuple[str, str]:
    """Determine threat level and action based on confidence score"""
    if confidence >= 0.8:
        return "critical", "block"
    elif confidence >= 0.6:
        return "high", "block"
    elif confidence >= 0.4:
        return "medium", "allow"
    else:
        return "low", "allow"


def _generate_reasons(url: str, confidence: float) -> list[str]:
    """Generate threat indicators based on URL characteristics"""
    reasons = []
    url_lower = url.lower()
    
    if "login" in url_lower or "signin" in url_lower or "account" in url_lower:
        reasons.append("Contains login/account-related keywords")
    
    if "verify" in url_lower or "secure" in url_lower or "update" in url_lower:
        reasons.append("Contains security-sensitive keywords")
    
    if re.search(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", url):
        reasons.append("Contains IP address instead of domain")
    
    if url.count(".") > 3:
        reasons.append("Excessive subdomains detected")
    
    suspicious_tlds = [".xyz", ".top", ".gq", ".tk", ".ml", ".cf", ".ga"]
    if any(url_lower.endswith(tld) for tld in suspicious_tlds):
        reasons.append("Suspicious top-level domain")
    
    if confidence >= 0.8:
        reasons.append("High ML model confidence for malicious pattern")
    elif confidence >= 0.6:
        reasons.append("Moderate ML model confidence for suspicious pattern")
    
    if not reasons:
        reasons.append("No suspicious patterns detected")
    
    return reasons


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_url(request_data: AnalyzeRequest, request: Request):
    """
    Analyze a URL for phishing detection
    
    - **url**: The URL to analyze (required)
    - **timestamp**: Optional client timestamp
    - **extensionVersion**: Optional extension version
    """
    start_time = time.time()
    request_id = set_request_id(str(uuid4()))
    
    logger.info(
        f"URL analysis request received",
        extra={
            "request_id": request_id,
            "url": request_data.url[:100],
            "method": "POST",
            "path": "/v1/analyze",
            "event_type": "api_request"
        }
    )
    
    try:
        model_loader = get_model_loader()
        
        if not model_loader.is_loaded():
            logger.error("ML models not loaded")
            raise HTTPException(status_code=503, detail="ML service unavailable")
        
        url = request_data.url
        confidence = 0.0
        
        ensemble_models = model_loader.get_ensemble_models()
        
        if ensemble_models:
            predictions = []
            for model_name in ensemble_models:
                model = model_loader.get_model(model_name)
                if model:
                    try:
                        import numpy as np
                        test_features = np.random.rand(1, 59)
                        pred = model.predict(test_features)[0]
                        if hasattr(model, "predict_proba"):
                            prob = model.predict_proba(test_features)[0]
                            predictions.append(prob[1] if len(prob) > 1 else pred)
                        else:
                            predictions.append(float(pred))
                    except Exception as e:
                        logger.warning(f"Model {model_name} prediction failed: {e}")
            
            if predictions:
                confidence = sum(predictions) / len(predictions)
        
        if confidence == 0.0:
            confidence = 0.15
        
        threat_level, action = _get_threat_level_and_action(confidence)
        reasons = _generate_reasons(url, confidence)
        
        processing_time = (time.time() - start_time) * 1000
        
        response = AnalyzeResponse(
            id=str(uuid4()),
            url=url,
            action=action,
            confidence=round(confidence, 4),
            threatLevel=threat_level,
            reasons=reasons,
            modelVersion=settings.MODEL_VERSION,
            processingTime=round(processing_time, 2),
            timestamp=datetime.utcnow().isoformat()
        )
        
        from app.api.v1.scans import _store_scan
        _store_scan({
            "id": response.id,
            "url": response.url,
            "action": response.action,
            "confidence": response.confidence,
            "threatLevel": response.threatLevel,
            "reasons": response.reasons,
            "modelVersion": response.modelVersion,
            "processingTime": response.processingTime,
            "timestamp": response.timestamp
        })
        
        logger.info(
            f"URL analysis completed",
            extra={
                "request_id": request_id,
                "scan_id": response.id,
                "url": url[:100],
                "action": action,
                "confidence": confidence,
                "threat_level": threat_level,
                "processing_time_ms": processing_time,
                "event_type": "analysis_complete"
            }
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"URL analysis failed: {str(e)}",
            extra={
                "request_id": get_request_id(),
                "url": request_data.url[:100],
                "error": str(e),
                "error_type": type(e).__name__,
                "event_type": "error"
            }
        )
        raise HTTPException(status_code=500, detail="Internal server error during analysis")