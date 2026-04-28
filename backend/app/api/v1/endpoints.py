"""
NGIPS Phishing Shield - API Router Combiner
Combines all v1 API routers into a single router
"""

from fastapi import APIRouter

from app.api.v1 import analyze, feedback, scans, stats

api_router = APIRouter()

api_router.include_router(analyze.router, tags=["Analysis"])
api_router.include_router(feedback.router, tags=["Feedback"])
api_router.include_router(scans.router, tags=["Scans"])
api_router.include_router(stats.router, tags=["Statistics"])