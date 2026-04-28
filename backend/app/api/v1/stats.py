"""
NGIPS Phishing Shield - Statistics API Endpoint
GET /v1/stats - Get aggregate statistics
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from collections import Counter

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_stats_from_scans() -> Dict[str, Any]:
    """Calculate statistics from scan history"""
    from app.api.v1.scans import scan_history
    
    if not scan_history:
        return {
            "totalScans": 0,
            "blockedCount": 0,
            "allowedCount": 0,
            "blockRate": 0.0,
            "threatLevelDistribution": {
                "low": 0,
                "medium": 0,
                "high": 0,
                "critical": 0
            },
            "avgConfidence": 0.0,
            "recentScansLast24h": 0
        }
    
    total = len(scan_history)
    blocked = sum(1 for s in scan_history.values() if s.get("action") == "block")
    allowed = total - blocked
    
    threat_levels = Counter(s.get("threatLevel", "unknown") for s in scan_history.values())
    threat_dist = {
        "low": threat_levels.get("low", 0),
        "medium": threat_levels.get("medium", 0),
        "high": threat_levels.get("high", 0),
        "critical": threat_levels.get("critical", 0)
    }
    
    confidences = [s.get("confidence", 0.0) for s in scan_history.values()]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    
    now = datetime.utcnow()
    recent_24h = sum(
        1 for s in scan_history.values()
        if datetime.fromisoformat(s.get("timestamp", "2000-01-01")) > (now - timedelta(hours=24))
    )
    
    return {
        "totalScans": total,
        "blockedCount": blocked,
        "allowedCount": allowed,
        "blockRate": round(blocked / total, 4) if total > 0 else 0.0,
        "threatLevelDistribution": threat_dist,
        "avgConfidence": round(avg_confidence, 4),
        "recentScansLast24h": recent_24h
    }


def _get_feedback_stats() -> Dict[str, Any]:
    """Calculate feedback statistics"""
    from app.api.v1.feedback import feedback_store
    
    if not feedback_store:
        return {
            "totalFeedback": 0,
            "falsePositiveReports": 0,
            "falsePositiveRate": 0.0
        }
    
    total = len(feedback_store)
    fp_count = sum(1 for f in feedback_store.values() if f.get("is_false_positive", False))
    
    return {
        "totalFeedback": total,
        "falsePositiveReports": fp_count,
        "falsePositiveRate": round(fp_count / total, 4) if total > 0 else 0.0
    }


class StatsResponse(BaseModel):
    """Response model for statistics"""
    totalScans: int = Field(..., description="Total number of scans")
    blockedCount: int = Field(..., description="Number of blocked URLs")
    allowedCount: int = Field(..., description="Number of allowed URLs")
    blockRate: float = Field(..., description="Block rate as percentage")
    threatLevelDistribution: Dict[str, int] = Field(..., description="Distribution by threat level")
    avgConfidence: float = Field(..., description="Average confidence score")
    recentScansLast24h: int = Field(..., description="Scans in last 24 hours")
    totalFeedback: int = Field(..., description="Total feedback submissions")
    falsePositiveReports: int = Field(..., description="False positive reports")
    falsePositiveRate: float = Field(..., description="False positive rate")
    timestamp: str = Field(..., description="Stats generation timestamp")


@router.get("/stats", response_model=StatsResponse)
async def get_statistics():
    """
    Get aggregate statistics for the phishing detection system
    
    Returns overall statistics including:
    - Scan counts and block rates
    - Threat level distribution
    - Recent activity
    - Feedback statistics
    """
    logger.info(
        f"Statistics request received",
        extra={
            "event_type": "api_request"
        }
    )
    
    try:
        scan_stats = _get_stats_from_scans()
        feedback_stats = _get_feedback_stats()
        
        response = StatsResponse(
            totalScans=scan_stats["totalScans"],
            blockedCount=scan_stats["blockedCount"],
            allowedCount=scan_stats["allowedCount"],
            blockRate=scan_stats["blockRate"],
            threatLevelDistribution=scan_stats["threatLevelDistribution"],
            avgConfidence=scan_stats["avgConfidence"],
            recentScansLast24h=scan_stats["recentScansLast24h"],
            totalFeedback=feedback_stats["totalFeedback"],
            falsePositiveReports=feedback_stats["falsePositiveReports"],
            falsePositiveRate=feedback_stats["falsePositiveRate"],
            timestamp=datetime.utcnow().isoformat()
        )
        
        logger.info(
            f"Statistics generated",
            extra={
                "total_scans": scan_stats["totalScans"],
                "block_rate": scan_stats["blockRate"],
                "event_type": "api_response"
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(
            f"Failed to generate statistics: {str(e)}",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "event_type": "error"
            }
        )
        raise HTTPException(status_code=500, detail="Failed to generate statistics")