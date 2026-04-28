"""
NGIPS Phishing Shield - User Feedback API Endpoint
POST /v1/feedback - Submit feedback on scan results
"""

import logging
from datetime import datetime
from typing import Optional, Dict
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

feedback_store: Dict[str, dict] = {}


class FeedbackRequest(BaseModel):
    """Request model for user feedback"""
    scanId: str = Field(..., min_length=1, description="ID of the scan to provide feedback on")
    isFalsePositive: bool = Field(..., description="True if user believes the result was wrong")
    userComment: Optional[str] = Field(None, max_length=1000, description="Optional user comment")


class FeedbackResponse(BaseModel):
    """Response model for feedback submission"""
    id: str = Field(..., description="Unique feedback ID")
    scanId: str = Field(..., description="Scan ID that was reviewed")
    status: str = Field(..., description="Feedback status: submitted, duplicate, error")
    timestamp: str = Field(..., description="Feedback submission timestamp")
    isFalsePositive: bool = Field(..., description="Whether feedback indicates false positive")
    userComment: Optional[str] = Field(None, description="User's comment if provided")


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(feedback_data: FeedbackRequest):
    """
    Submit user feedback on a scan result
    
    - **scanId**: The ID of the scan to provide feedback on
    - **isFalsePositive**: Whether the user believes the result was incorrect
    - **userComment**: Optional comment explaining the feedback
    """
    logger.info(
        f"Feedback submission received",
        extra={
            "scan_id": feedback_data.scanId,
            "is_false_positive": feedback_data.isFalsePositive,
            "has_comment": bool(feedback_data.userComment),
            "event_type": "feedback_submission"
        }
    )
    
    try:
        feedback_id = str(uuid4())
        
        existing_feedback = None
        for fb_id, fb_data in feedback_store.items():
            if fb_data["scan_id"] == feedback_data.scanId:
                existing_feedback = fb_id
                break
        
        if existing_feedback:
            logger.info(
                f"Duplicate feedback detected for scan",
                extra={
                    "scan_id": feedback_data.scanId,
                    "existing_feedback_id": existing_feedback,
                    "event_type": "duplicate_feedback"
                }
            )
            return FeedbackResponse(
                id=existing_feedback,
                scanId=feedback_data.scanId,
                status="duplicate",
                timestamp=datetime.utcnow().isoformat(),
                isFalsePositive=feedback_data.isFalsePositive,
                userComment=feedback_data.userComment
            )
        
        feedback_entry = {
            "id": feedback_id,
            "scan_id": feedback_data.scanId,
            "is_false_positive": feedback_data.isFalsePositive,
            "comment": feedback_data.userComment,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        feedback_store[feedback_id] = feedback_entry
        
        logger.info(
            f"Feedback stored successfully",
            extra={
                "feedback_id": feedback_id,
                "scan_id": feedback_data.scanId,
                "event_type": "feedback_stored"
            }
        )
        
        return FeedbackResponse(
            id=feedback_id,
            scanId=feedback_data.scanId,
            status="submitted",
            timestamp=feedback_entry["timestamp"],
            isFalsePositive=feedback_data.isFalsePositive,
            userComment=feedback_data.userComment
        )
        
    except Exception as e:
        logger.error(
            f"Feedback submission failed: {str(e)}",
            extra={
                "scan_id": feedback_data.scanId,
                "error": str(e),
                "error_type": type(e).__name__,
                "event_type": "error"
            }
        )
        raise HTTPException(status_code=500, detail="Failed to submit feedback")