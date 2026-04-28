# NGIPS Phishing Shield API Documentation

## Base URL
```
http://localhost:8000
```

## Endpoints

### 1. Analyze URL
**POST** `/v1/analyze`

Analyze a URL for phishing detection.

**Request:**
```json
{
  "url": "https://example.com",
  "timestamp": "2024-01-15T10:30:00Z",
  "extensionVersion": "1.0.0"
}
```

**Response (200):**
```json
{
  "id": "scan_abc123",
  "url": "https://example.com",
  "action": "allow",
  "confidence": 0.15,
  "threatLevel": "low",
  "reasons": ["No suspicious patterns detected"],
  "modelVersion": "20260416_170709",
  "processingTime": 45.2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400` - Invalid URL format
- `429` - Rate limit exceeded
- `500` - Internal server error
- `503` - ML service unavailable

---

### 2. Get Scan History
**GET** `/v1/scans?page=1&limit=50&action=blocked&url_contains=google`

Query parameters:
- `page` (int): Page number (default: 1)
- `limit` (int): Records per page (default: 50, max: 100)
- `action` (str): Filter by result ('blocked' | 'allowed')
- `url_contains` (str): Search in URL

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "totalPages": 25
  }
}
```

---

### 3. Submit Feedback
**POST** `/v1/feedback`

```json
{
  "scanId": "scan_abc123",
  "isFalsePositive": true,
  "userComment": "This is my company's site"
}
```

---

### 4. Get Statistics
**GET** `/v1/stats`

```json
{
  "totalScans": 1234,
  "blockedCount": 456,
  "allowedCount": 778,
  "blockRate": 0.37,
  "avgConfidence": 0.82,
  "pendingFeedback": 12,
  "confirmedFalsePositives": 3
}
```

---

### 5. Health Check
**GET** `/health`

```json
{
  "status": "healthy",
  "service": "ngips-phishing-shield",
  "version": "1.0.0",
  "models": {
    "status": "loaded",
    "count": 8,
    "version": "20260416_170709",
    "available": ["Logistic Regression", "LightGBM", "CatBoost", "Ensemble"]
  }
}
```

---

## Rate Limiting
- Limit: 100 requests per minute per IP
- Returns `429` with `Retry-After` header when exceeded

## Models
The API uses ensemble ML models trained on phishing URL datasets with 50+ features.