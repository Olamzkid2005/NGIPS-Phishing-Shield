"""
NGIPS Phishing Shield - Scan History API Endpoints
GET /v1/scans - List scan history with pagination and filtering
GET /v1/scans/{scan_id} - Get details of a specific scan
DELETE /v1/scans - Clear scan history
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

scan_history: Dict[str, dict] = {}


class ScanRecord(BaseModel):
    """Model for a scan record"""
    id: str = Field(..., description="Unique scan ID")
    url: str = Field(..., description="Analyzed URL")
    action: str = Field(..., description="Action taken: block or allow")
    confidence: float = Field(..., description="Confidence score")
    threatLevel: str = Field(..., description="Threat level")
    reasons: List[str] = Field(..., description="Threat indicators")
    timestamp: str = Field(..., description="Scan timestamp")


class PaginatedScansResponse(BaseModel):
    """Response model for paginated scan list"""
    items: List[ScanRecord] = Field(..., description="List of scan records")
    total: int = Field(..., description="Total number of scans")
    page: int = Field(..., description="Current page number")
    pageSize: int = Field(..., description="Items per page")
    totalPages: int = Field(..., description="Total number of pages")


class ScanDetailResponse(BaseModel):
    """Response model for single scan details"""
    id: str = Field(..., description="Unique scan ID")
    url: str = Field(..., description="Analyzed URL")
    action: str = Field(..., description="Action taken")
    confidence: float = Field(..., description="Confidence score")
    threatLevel: str = Field(..., description="Threat level")
    reasons: List[str] = Field(..., description="Threat indicators")
    modelVersion: str = Field(..., description="Model version used")
    processingTime: float = Field(..., description="Processing time in ms")
    timestamp: str = Field(..., description="Scan timestamp")


class ClearHistoryResponse(BaseModel):
    """Response model for clearing history"""
    status: str = Field(..., description="Status message")
    deletedCount: int = Field(..., description="Number of records deleted")
    timestamp: str = Field(..., description="Operation timestamp")


def _store_scan(scan_data: dict) -> None:
    """Store a scan record in history"""
    scan_history[scan_data["id"]] = scan_data


@router.get("/scans", response_model=PaginatedScansResponse)
async def get_scans(
    page: int = Query(1, ge=1, description="Page number"),
    pageSize: int = Query(20, ge=1, le=100, description="Items per page"),
    action: Optional[str] = Query(None, description="Filter by action (block/allow)"),
    threatLevel: Optional[str] = Query(None, description="Filter by threat level"),
    url_contains: Optional[str] = Query(None, description="Filter by URL substring")
):
    """
    Get scan history with pagination and optional filtering
    
    - **page**: Page number (default: 1)
    - **pageSize**: Items per page (default: 20, max: 100)
    - **action**: Filter by action type (block/allow)
    - **threatLevel**: Filter by threat level (low, medium, high, critical)
    - **url_contains**: Filter by URL substring
    """
    logger.info(
        f"Scan history request received",
        extra={
            "page": page,
            "page_size": pageSize,
            "action_filter": action,
            "threat_level_filter": threatLevel,
            "url_filter": url_contains,
            "event_type": "api_request"
        }
    )
    
    try:
        filtered_scans = list(scan_history.values())
        
        if action:
            filtered_scans = [s for s in filtered_scans if s.get("action") == action]
        
        if threatLevel:
            filtered_scans = [s for s in filtered_scans if s.get("threatLevel") == threatLevel]
        
        if url_contains:
            filtered_scans = [s for s in filtered_scans if url_contains.lower() in s.get("url", "").lower()]
        
        filtered_scans.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        total = len(filtered_scans)
        total_pages = (total + pageSize - 1) // pageSize if total > 0 else 1
        
        start_idx = (page - 1) * pageSize
        end_idx = start_idx + pageSize
        page_items = filtered_scans[start_idx:end_idx]
        
        items = [
            ScanRecord(
                id=scan["id"],
                url=scan["url"],
                action=scan["action"],
                confidence=scan["confidence"],
                threatLevel=scan["threatLevel"],
                reasons=scan["reasons"],
                timestamp=scan["timestamp"]
            )
            for scan in page_items
        ]
        
        logger.info(
            f"Scan history retrieved",
            extra={
                "total": total,
                "page": page,
                "page_size": pageSize,
                "returned_items": len(items),
                "event_type": "api_response"
            }
        )
        
        return PaginatedScansResponse(
            items=items,
            total=total,
            page=page,
            pageSize=pageSize,
            totalPages=total_pages
        )
        
    except Exception as e:
        logger.error(
            f"Failed to retrieve scan history: {str(e)}",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "event_type": "error"
            }
        )
        raise HTTPException(status_code=500, detail="Failed to retrieve scan history")


@router.get("/scans/{scan_id}", response_model=ScanDetailResponse)
async def get_scan_details(scan_id: str):
    """
    Get details of a specific scan by ID
    
    - **scan_id**: The unique ID of the scan
    """
    logger.info(
        f"Scan detail request received",
        extra={
            "scan_id": scan_id,
            "event_type": "api_request"
        }
    )
    
    if scan_id not in scan_history:
        logger.warning(
            f"Scan not found",
            extra={
                "scan_id": scan_id,
                "event_type": "not_found"
            }
        )
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan = scan_history[scan_id]
    
    return ScanDetailResponse(
        id=scan["id"],
        url=scan["url"],
        action=scan["action"],
        confidence=scan["confidence"],
        threatLevel=scan["threatLevel"],
        reasons=scan["reasons"],
        modelVersion=scan.get("modelVersion", "unknown"),
        processingTime=scan.get("processingTime", 0.0),
        timestamp=scan["timestamp"]
    )


@router.delete("/scans", response_model=ClearHistoryResponse)
async def clear_scan_history():
    """
    Clear all scan history
    
    Returns the number of records deleted
    """
    logger.info(
        f"Clear scan history request received",
        extra={
            "event_type": "api_request"
        }
    )
    
    try:
        deleted_count = len(scan_history)
        scan_history.clear()
        
        logger.info(
            f"Scan history cleared",
            extra={
                "deleted_count": deleted_count,
                "event_type": "history_cleared"
            }
        )
        
        return ClearHistoryResponse(
            status="success",
            deletedCount=deleted_count,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(
            f"Failed to clear scan history: {str(e)}",
            extra={
                "error": str(e),
                "error_type": type(e).__name__,
                "event_type": "error"
            }
        )
        raise HTTPException(status_code=500, detail="Failed to clear scan history")