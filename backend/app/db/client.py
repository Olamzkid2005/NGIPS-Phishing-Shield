import json
from datetime import datetime
from typing import Optional
from prisma import Client, models

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = Client()
    return _client


async def connect_db() -> None:
    client = get_client()
    await client.connect()


async def disconnect_db() -> None:
    client = get_client()
    await client.disconnect()


async def create_scan(
    url: str,
    domain: str,
    result: str,
    confidence: float,
    threat_level: str,
    reasons: list[str],
    model_version: str,
    processing_time: int,
    features: dict,
) -> models.Scan:
    client = get_client()
    scan = await client.scan.create(
        data={
            "url": url,
            "domain": domain,
            "result": result,
            "confidence": confidence,
            "threatLevel": threat_level,
            "reasons": json.dumps(reasons),
            "modelVersion": model_version,
            "processingTime": processing_time,
            "features": json.dumps(features),
        }
    )
    return scan


async def get_scan(scan_id: str) -> Optional[models.Scan]:
    client = get_client()
    return await client.scan.find_unique(where={"id": scan_id})


async def get_scans(
    skip: int = 0,
    take: int = 100,
    result_filter: Optional[str] = None,
    domain_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[models.Scan]:
    client = get_client()
    where = {}

    if result_filter:
        where["result"] = result_filter
    if domain_filter:
        where["domain"] = domain_filter
    if start_date or end_date:
        where["timestamp"] = {}
        if start_date:
            where["timestamp"]["gte"] = start_date
        if end_date:
            where["timestamp"]["lte"] = end_date

    return await client.scan.find_many(
        where=where if where else None,
        skip=skip,
        take=take,
        order={"timestamp": "desc"},
    )


async def get_scans_count(
    result_filter: Optional[str] = None,
    domain_filter: Optional[str] = None,
) -> int:
    client = get_client()
    where = {}

    if result_filter:
        where["result"] = result_filter
    if domain_filter:
        where["domain"] = domain_filter

    return await client.scan.count(where=where if where else None)


async def get_scans_by_confidence(
    min_confidence: float,
    max_confidence: float,
    skip: int = 0,
    take: int = 100,
) -> list[models.Scan]:
    client = get_client()
    return await client.scan.find_many(
        where={
            "confidence": {"gte": min_confidence, "lte": max_confidence}
        },
        skip=skip,
        take=take,
        order={"timestamp": "desc"},
    )


async def create_feedback(
    scan_id: str,
    is_false_positive: bool,
    user_comment: Optional[str] = None,
) -> models.Feedback:
    client = get_client()
    feedback = await client.feedback.create(
        data={
            "scanId": scan_id,
            "isFalsePositive": is_false_positive,
            "userComment": user_comment,
        }
    )
    return feedback


async def get_feedback(feedback_id: str) -> Optional[models.Feedback]:
    client = get_client()
    return await client.feedback.find_unique(where={"id": feedback_id})


async def get_feedback_by_scan(scan_id: str) -> list[models.Feedback]:
    client = get_client()
    return await client.feedback.find_many(
        where={"scanId": scan_id},
        order={"timestamp": "desc"},
    )


async def get_feedback_list(
    skip: int = 0,
    take: int = 100,
    status_filter: Optional[str] = None,
) -> list[models.Feedback]:
    client = get_client()
    where = {}

    if status_filter:
        where["status"] = status_filter

    return await client.feedback.find_many(
        where=where if where else None,
        skip=skip,
        take=take,
        order={"timestamp": "desc"},
    )


async def update_feedback_status(
    feedback_id: str,
    status: str,
    reviewed_by: Optional[str] = None,
    admin_comment: Optional[str] = None,
) -> Optional[models.Feedback]:
    client = get_client()
    data = {"status": status}

    if reviewed_by:
        data["reviewedBy"] = reviewed_by
        data["reviewedAt"] = datetime.utcnow()
    if admin_comment:
        data["adminComment"] = admin_comment

    return await client.feedback.update(
        where={"id": feedback_id},
        data=data,
    )


async def get_config(key: str) -> Optional[models.Config]:
    client = get_client()
    return await client.config.find_unique(where={"key": key})


async def set_config(
    key: str,
    value: str,
    description: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> models.Config:
    client = get_client()
    return await client.config.upsert(
        where={"key": key},
        data={
            "create": {
                "key": key,
                "value": value,
                "description": description,
                "updatedBy": updated_by,
            },
            "update": {
                "value": value,
                "updatedBy": updated_by,
            },
        },
    )


async def get_all_config() -> list[models.Config]:
    client = get_client()
    return await client.config.find_many()


async def create_threat(
    url: str,
    domain: str,
    threat_level: str,
    source: str,
) -> models.Threat:
    client = get_client()
    threat = await client.threat.create(
        data={
            "url": url,
            "domain": domain,
            "threatLevel": threat_level,
            "source": source,
        }
    )
    return threat


async def get_threat(url: str) -> Optional[models.Threat]:
    client = get_client()
    return await client.threat.find_unique(where={"url": url})


async def get_threats(
    skip: int = 0,
    take: int = 100,
    threat_level_filter: Optional[str] = None,
    domain_filter: Optional[str] = None,
) -> list[models.Threat]:
    client = get_client()
    where = {}

    if threat_level_filter:
        where["threatLevel"] = threat_level_filter
    if domain_filter:
        where["domain"] = domain_filter

    return await client.threat.find_many(
        where=where if where else None,
        skip=skip,
        take=take,
        order={"lastSeen": "desc"},
    )


async def update_threat_block_count(threat_id: str) -> Optional[models.Threat]:
    client = get_client()
    threat = await client.threat.find_unique(where={"id": threat_id})
    if threat:
        return await client.threat.update(
            where={"id": threat_id},
            data={
                "blockCount": threat.blockCount + 1,
                "lastSeen": datetime.utcnow(),
            },
        )
    return None


async def create_model_metric(
    model_version: str,
    total_predictions: int,
    blocked_count: int,
    allowed_count: int,
    average_confidence: float,
    false_positive_count: int = 0,
    false_negative_count: int = 0,
    accuracy: Optional[float] = None,
    precision: Optional[float] = None,
    recall: Optional[float] = None,
    f1_score: Optional[float] = None,
) -> models.ModelMetric:
    client = get_client()
    return await client.modelmetric.create(
        data={
            "modelVersion": model_version,
            "totalPredictions": total_predictions,
            "blockedCount": blocked_count,
            "allowedCount": allowed_count,
            "averageConfidence": average_confidence,
            "falsePositiveCount": false_positive_count,
            "falseNegativeCount": false_negative_count,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1Score": f1_score,
        }
    )


async def get_model_metrics(
    skip: int = 0,
    take: int = 100,
    model_version_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> list[models.ModelMetric]:
    client = get_client()
    where = {}

    if model_version_filter:
        where["modelVersion"] = model_version_filter
    if start_date or end_date:
        where["date"] = {}
        if start_date:
            where["date"]["gte"] = start_date
        if end_date:
            where["date"]["lte"] = end_date

    return await client.modelmetric.find_many(
        where=where if where else None,
        skip=skip,
        take=take,
        order={"date": "desc"},
    )


async def get_latest_model_metric(
    model_version: Optional[str] = None,
) -> Optional[models.ModelMetric]:
    client = get_client()
    where = {}
    if model_version:
        where["modelVersion"] = model_version

    metrics = await client.modelmetric.find_many(
        where=where if where else None,
        order={"date": "desc"},
        take=1,
    )
    return metrics[0] if metrics else None


async def get_stats() -> dict:
    client = get_client()

    total_scans = await client.scan.count()
    blocked_scans = await client.scan.count(where={"result": "blocked"})
    allowed_scans = await client.scan.count(where={"result": "allowed"})

    pending_feedback = await client.feedback.count(where={"status": "pending"})
    confirmed_fp = await client.feedback.count(
        where={"status": "confirmed", "isFalsePositive": True}
    )

    total_threats = await client.threat.count()

    return {
        "total_scans": total_scans,
        "blocked_scans": blocked_scans,
        "allowed_scans": allowed_scans,
        "pending_feedback": pending_feedback,
        "confirmed_false_positives": confirmed_fp,
        "total_threats": total_threats,
    }