# Design Document: NGIPS Transformation with AI

## Overview

This design document specifies the architecture and implementation approach for transforming the Olazkid phishing detection repository from a standalone Flask web application into a comprehensive Next-Generation Intrusion Prevention System (NGIPS). The transformation involves three major components working together to provide real-time phishing protection:

1. **Sensor (Browser Extension)**: A Manifest V3 Chrome extension that intercepts URL navigation events and communicates with the AI inspection engine
2. **AI_Inspection_Engine (React Backend)**: A high-performance backend that performs ML-based phishing detection with advanced AI capabilities
3. **Management_Dashboard (Next.js 15)**: A modern web application for monitoring, analytics, configuration, and feedback management

The system maintains the existing ML models (Logistic Regression and Naive Bayes) while adding ensemble prediction, advanced feature extraction, threat intelligence integration, and comprehensive monitoring capabilities. The architecture follows API-first principles with clear separation of concerns, enabling each component to be developed, tested, and deployed independently.

## Architecture

### System Architecture

The NGIPS follows a three-tier architecture with clear boundaries between components:

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser User                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Sensor (Browser Extension)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Service    │  │   Content    │  │    Popup     │     │
│  │   Worker     │  │   Script     │  │  Interface   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS/REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            AI_Inspection_Engine (React Backend)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   API Layer  │  │   ML Engine  │  │  Threat Intel│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Database   │  │   Logging    │                        │
│  └──────────────┘  └──────────────┘                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Database                           │
│  (Scans, Feedback, Config, Threats, Model Metrics)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Management_Dashboard (Next.js 15)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Monitoring  │  │  Analytics   │  │   Feedback   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Settings   │  │  API Routes  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **URL Interception**: User navigates to URL → Sensor intercepts via chrome.webNavigation API
2. **Analysis Request**: Sensor sends URL to `/v1/analyze` endpoint with timeout
3. **ML Processing**: AI_Inspection_Engine extracts features, runs ensemble models, checks threat intelligence
4. **Response**: Engine returns action (block/allow) with confidence score and reasoning
5. **Action Execution**: Sensor either blocks with overlay or allows navigation
6. **Logging**: All requests logged to database with full context
7. **Dashboard Updates**: Management_Dashboard polls database for real-time updates

### Technology Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Backend Framework** | Express.js | Async support, automatic OpenAPI docs, high performance for ML inference |
| **Database** | SQLite + Prisma ORM | Lightweight, file-based, zero-config, Prisma provides type-safe queries |
| **ML Framework** | Scikit-learn | Existing models, mature ecosystem, joblib serialization |
| **Browser Extension** | Manifest V3 | Latest Chrome extension platform, service workers for background processing |
| **Frontend Framework** | Next.js 15 (App Router) | React Server Components, built-in API routes, excellent performance |
| **UI Components** | React + Tailwind CSS | Component reusability, utility-first styling, accessibility support |
| **Charts/Visualization** | Recharts or Chart.js | React-friendly, responsive charts for analytics |
| **Testing** | Pytest (backend), Jest/Vitest (frontend), Playwright (E2E) | Comprehensive testing at all levels |
| **Deployment** | Docker + Docker Compose | Containerization for consistent environments |

### Design Principles

1. **API-First**: All functionality exposed through well-defined REST APIs
2. **Separation of Concerns**: Each component has single responsibility
3. **Fail-Safe**: System allows navigation when backend unavailable
4. **Performance**: <100ms API response time, <50ms extension overhead
5. **Privacy**: Only URLs sent to backend, no page content or user data
6. **Extensibility**: Modular design allows adding new ML models or threat feeds
7. **Observability**: Comprehensive logging and metrics at all layers

## Components and Interfaces

### Component 1: Sensor (Browser Extension)

**Purpose**: Real-time URL interception and phishing prevention at the browser level

**Technology**: Manifest V3 Chrome Extension (JavaScript)

**Sub-components**:

1. **Service Worker (background/service-worker.js)**
   - Listens to chrome.webNavigation.onBeforeNavigate events
   - Manages API communication with AI_Inspection_Engine
   - Implements local caching (1-hour TTL) to reduce API calls
   - Handles offline scenarios gracefully
   - Manages whitelist storage and lookup

2. **Content Script (content/content-script.js)**
   - Injected into pages when blocking is required
   - Renders warning overlay with threat information
   - Handles user interactions (go back, report false positive, proceed anyway)
   - Communicates with service worker via message passing

3. **Popup Interface (popup/popup.html, popup.js)**
   - Displays recent scan statistics
   - Shows whitelist management UI
   - Provides settings interface
   - Displays extension status and health

4. **API Client (utils/api.js)**
   - Centralized API communication logic
   - Implements retry logic with exponential backoff
   - Handles timeout (5 seconds)
   - Manages error states

**Interfaces**:

```typescript
// API Request to AI_Inspection_Engine
interface AnalyzeRequest {
  url: string;
  timestamp: number;
  extensionVersion: string;
}

// API Response from AI_Inspection_Engine
interface AnalyzeResponse {
  action: 'block' | 'allow';
  confidence: number; // 0.0 to 1.0
  threatLevel: 'high' | 'medium' | 'low' | 'none';
  reasons: string[]; // e.g., ["Known phishing site", "Suspicious URL structure"]
  modelVersion: string;
  processingTime: number; // milliseconds
}

// Local Storage Schema
interface ExtensionStorage {
  whitelist: string[]; // domains
  cache: {
    [url: string]: {
      result: AnalyzeResponse;
      timestamp: number;
    }
  };
  settings: {
    enabled: boolean;
    allowProceedOnWarning: boolean;
    cacheEnabled: boolean;
  };
  stats: {
    totalScans: number;
    blockedCount: number;
    lastScanTime: number;
  };
}
```

**Key Behaviors**:

- **Caching**: Cache analysis results for 1 hour to avoid repeated API calls for same URL
- **Whitelist**: Bypass analysis for user-whitelisted domains
- **Timeout Handling**: If API doesn't respond within 5 seconds, allow navigation (fail-safe)
- **Offline Mode**: If backend unreachable, allow navigation with warning notification
- **Rate Limiting**: Debounce rapid navigation events (e.g., redirects)

### Component 2: AI_Inspection_Engine (React Backend)

**Purpose**: High-performance ML-based phishing detection with advanced AI capabilities

**Technology**: Node.js + Express

**Sub-components**:

1. **API Layer (app/api/v1/)**
   - `/v1/analyze` - URL analysis endpoint (POST)
   - `/v1/feedback` - User feedback submission (POST)
   - `/health` - Health check endpoint (GET)
   - `/metrics` - Performance metrics endpoint (GET)
   - Implements rate limiting (100 req/min per IP)
   - CORS configuration for browser extension origin
   - Input validation and sanitization

2. **ML Engine (app/ml/)**
   - **models.py**: Model loading and management
   - **feature_extraction.py**: URL feature extraction (TLD, path length, special chars, etc.)
   - **ensemble.py**: Ensemble prediction combining multiple models
   - **inference.py**: Prediction pipeline orchestration

3. **Threat Intelligence (app/threat_intel/)**
   - Integration with PhishTank API
   - Integration with OpenPhish feed
   - Local threat database caching
   - Reputation scoring logic

4. **Database Layer (app/db/)**
   - Prisma ORM integration
   - Models for scans, feedback, config, threats, metrics
   - Transaction management
   - Query optimization with indexes

5. **Logging & Monitoring (app/core/)**
   - Structured JSON logging
   - Request/response logging
   - Error tracking
   - Performance metrics collection

**Interfaces**:

```python
# API Endpoint Schemas (Pydantic)
class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    timestamp: Optional[int] = None
    extensionVersion: Optional[str] = None

class AnalyzeResponse(BaseModel):
    action: Literal['block', 'allow']
    confidence: float = Field(..., ge=0.0, le=1.0)
    threatLevel: Literal['high', 'medium', 'low', 'none']
    reasons: List[str]
    modelVersion: str
    processingTime: int  # milliseconds

class FeedbackRequest(BaseModel):
    scanId: str
    isFalsePositive: bool
    userComment: Optional[str] = None

# Feature Extraction Output
class URLFeatures(BaseModel):
    url_length: int
    domain_length: int
    path_length: int
    subdomain_count: int
    special_char_count: int
    digit_count: int
    has_https: bool
    tld: str
    suspicious_keywords: List[str]
    entropy: float

# Ensemble Prediction
class EnsemblePrediction(BaseModel):
    finalPrediction: Literal['phishing', 'legitimate']
    confidence: float
    modelPredictions: Dict[str, float]  # model_name -> probability
    agreement: float  # 0.0 to 1.0, how much models agree
```

**Key Behaviors**:

- **Model Loading**: Load all ML models at startup, fail fast if models missing/corrupted
- **Feature Extraction**: Extract 20+ features from URL structure
- **Ensemble Voting**: Combine predictions from multiple models with weighted voting
- **Threat Intelligence**: Check URL against known malicious databases first (fast path)
- **Confidence Scoring**: Calculate confidence based on model agreement and threat intel
- **Uncertainty Quantification**: Flag low-confidence predictions for manual review
- **Performance**: Target <100ms response time at 95th percentile
- **Error Handling**: Return 503 if models unavailable, 429 if rate limited, 400 for invalid input

### Component 3: Management_Dashboard (Next.js 15)

**Purpose**: Modern web interface for monitoring, analytics, configuration, and feedback management

**Technology**: Next.js 15 (App Router) + React Server Components

**Sub-components**:

1. **Pages (app/)**
   - `/` - Dashboard home with real-time scan monitoring
   - `/scans` - Detailed scan history with filtering and search
   - `/analytics` - Threat analytics with charts and visualizations
   - `/feedback` - User feedback management interface
   - `/settings` - System configuration and model settings

2. **API Routes (app/api/)**
   - `/api/scans` - Fetch scan data with pagination
   - `/api/stats` - Aggregate statistics for dashboard
   - `/api/feedback` - Feedback CRUD operations
   - `/api/config` - Configuration management

3. **Components (components/)**
   - **ui/**: Reusable UI components (buttons, inputs, cards, tables)
   - **charts/**: Chart components for analytics (line, pie, bar, heatmap)
   - **tables/**: Data table components with sorting, filtering, pagination
   - **forms/**: Form components for settings and feedback

4. **Database Access (lib/)**
   - Prisma client initialization
   - Server-side data fetching functions
   - Database query helpers

**Interfaces**:

```typescript
// Scan Data Model
interface Scan {
  id: string;
  url: string;
  result: 'blocked' | 'allowed';
  confidence: number;
  threatLevel: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
  timestamp: Date;
  modelVersion: string;
  processingTime: number;
  features: Record<string, any>;
}

// Feedback Data Model
interface Feedback {
  id: string;
  scanId: string;
  scan: Scan;
  isFalsePositive: boolean;
  userComment: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'under_review';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  adminComment: string | null;
  timestamp: Date;
}

// Analytics Data
interface AnalyticsData {
  scanVolume: { timestamp: Date; count: number }[];
  blockRate: { date: Date; blocked: number; allowed: number }[];
  topBlockedDomains: { domain: string; count: number }[];
  modelAccuracy: { date: Date; accuracy: number; precision: number; recall: number }[];
  falsePositiveRate: number;
  averageConfidence: number;
}

// Configuration
interface SystemConfig {
  confidenceThreshold: number;
  rateLimitPerMinute: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  threatIntelEnabled: boolean;
  modelVersion: string;
  logLevel: 'debug' | 'info' | 'warning' | 'error';
}
```

**Key Behaviors**:

- **Real-time Updates**: Poll database every 5 seconds for new scans
- **Server-Side Rendering**: Use React Server Components for initial page load
- **Pagination**: 50 records per page for scan history
- **Filtering**: Filter by result, date range, confidence threshold, threat level
- **Search**: Full-text search on URL and domain
- **Export**: Export scan data and feedback to CSV
- **Responsive**: Mobile-first design, works on all screen sizes
- **Dark Mode**: Support system preference and manual toggle
- **Accessibility**: WCAG 2.1 Level AA compliance

## Data Models

### Database Schema (Prisma)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Scan {
  id              String   @id @default(cuid())
  url             String
  domain          String   // Extracted domain for indexing
  result          String   // 'blocked' or 'allowed'
  confidence      Float
  threatLevel     String   // 'high', 'medium', 'low', 'none'
  reasons         String   // JSON array of reasons
  modelVersion    String
  processingTime  Int      // milliseconds
  features        String   // JSON object of extracted features
  timestamp       DateTime @default(now())
  
  feedback        Feedback[]
  
  @@index([timestamp])
  @@index([domain])
  @@index([result])
  @@index([confidence])
}

model Feedback {
  id              String   @id @default(cuid())
  scanId          String
  scan            Scan     @relation(fields: [scanId], references: [id], onDelete: Cascade)
  isFalsePositive Boolean
  userComment     String?
  status          String   @default("pending") // 'pending', 'confirmed', 'rejected', 'under_review'
  reviewedBy      String?
  reviewedAt      DateTime?
  adminComment    String?
  timestamp       DateTime @default(now())
  
  @@index([scanId])
  @@index([status])
  @@index([timestamp])
}

model Config {
  key         String   @id
  value       String
  description String?
  updatedAt   DateTime @updatedAt
  updatedBy   String?
}

model Threat {
  id          String   @id @default(cuid())
  url         String   @unique
  domain      String
  threatLevel String   // 'high', 'medium', 'low'
  source      String   // 'phishtank', 'openphish', 'user_report'
  blockCount  Int      @default(0)
  firstSeen   DateTime @default(now())
  lastSeen    DateTime @default(now())
  
  @@index([domain])
  @@index([lastSeen])
}

model ModelMetric {
  id              String   @id @default(cuid())
  date            DateTime @default(now())
  modelVersion    String
  totalPredictions Int
  blockedCount    Int
  allowedCount    Int
  averageConfidence Float
  falsePositiveCount Int
  falseNegativeCount Int
  accuracy        Float?
  precision       Float?
  recall          Float?
  f1Score         Float?
  
  @@index([date])
  @@index([modelVersion])
}
```

### Data Flow

1. **Scan Creation**:
   - Extension sends URL to `/v1/analyze`
   - Backend extracts features, runs models, checks threat intel
   - Result saved to `Scan` table with all metadata
   - Response returned to extension

2. **Feedback Submission**:
   - User reports false positive from warning overlay
   - Extension sends feedback to `/v1/feedback`
   - Backend creates `Feedback` record linked to `Scan`
   - Dashboard displays feedback for admin review

3. **Configuration Updates**:
   - Admin modifies settings in dashboard
   - Dashboard sends update to `/api/config`
   - Backend updates `Config` table
   - Changes take effect immediately (or on next request)

4. **Threat Intelligence**:
   - Backend periodically fetches from PhishTank/OpenPhish
   - New threats added to `Threat` table
   - Existing threats updated with `lastSeen` timestamp
   - Stale threats (>90 days) archived or removed

5. **Metrics Collection**:
   - Backend aggregates daily metrics from `Scan` and `Feedback` tables
   - Calculates accuracy, precision, recall, F1 score
   - Stores in `ModelMetric` table
   - Dashboard queries for analytics visualizations

## Error Handling

### Error Categories and Responses

1. **Client Errors (4xx)**
   - **400 Bad Request**: Invalid URL format, missing required fields
   - **429 Too Many Requests**: Rate limit exceeded (100 req/min)
   - **403 Forbidden**: Invalid API key (if authentication enabled)

2. **Server Errors (5xx)**
   - **500 Internal Server Error**: Unexpected error in processing
   - **503 Service Unavailable**: Models not loaded, database unavailable

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "URL format is invalid",
    "details": "URL must start with http:// or https://",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### Error Handling Strategies

**Backend (React)**:
- Use Express error handlers for consistent error responses
- Log all errors with full context (request ID, user IP, timestamp, stack trace)
- Return generic error messages to clients (don't expose internal details)
- Implement circuit breaker for external services (threat intelligence APIs)
- Retry database operations with exponential backoff (max 3 retries)
- Fail fast on startup if critical resources unavailable (models, database)

**Extension (Browser)**:
- Timeout after 5 seconds, allow navigation (fail-safe)
- Display user-friendly error messages (avoid technical jargon)
- Retry failed requests with exponential backoff (max 3 retries)
- Cache last known good state for offline scenarios
- Log errors to extension console for debugging
- Provide "Report Issue" button in error states

**Dashboard (Next.js)**:
- Use error boundaries to catch React errors
- Display user-friendly error pages (404, 500)
- Retry failed API requests automatically
- Show loading states during data fetching
- Provide fallback UI when data unavailable
- Log errors to monitoring service (optional)

### Logging Strategy

**Structured Logging Format (JSON)**:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "ERROR",
  "service": "ai_inspection_engine",
  "requestId": "req_abc123",
  "endpoint": "/v1/analyze",
  "method": "POST",
  "statusCode": 500,
  "error": {
    "type": "ModelPredictionError",
    "message": "Failed to load model",
    "stack": "..."
  },
  "context": {
    "url": "https://example.com",
    "modelVersion": "v1.0.0",
    "clientIP": "192.168.1.1"
  }
}
```

**Log Levels**:
- **DEBUG**: Detailed information for debugging (feature values, model outputs)
- **INFO**: General information (request received, prediction made)
- **WARNING**: Unexpected but handled situations (low confidence, timeout)
- **ERROR**: Errors that need attention (model failure, database error)
- **CRITICAL**: System-level failures (startup failure, data corruption)

**Log Rotation**:
- Rotate logs daily
- Retain logs for 30 days
- Compress old logs
- Maximum log file size: 100MB

**Privacy Considerations**:
- Hash full URLs in logs (store only domain + path hash)
- Never log user credentials or API keys
- Redact PII from error messages
- Separate audit logs for security events

## Testing Strategy

### Testing Pyramid

```
                    /\
                   /  \
                  / E2E \
                 /--------\
                /          \
               / Integration \
              /--------------\
             /                \
            /   Unit Tests     \
           /____________________\
```

### Unit Testing

**Backend (Pytest)**:
- Test each API endpoint with valid/invalid inputs
- Test feature extraction with various URL patterns
- Test ensemble model logic with mock predictions
- Test database operations with in-memory SQLite
- Test error handling and edge cases
- Target: 80% code coverage minimum

**Frontend (Jest/Vitest)**:
- Test React components in isolation
- Test form validation logic
- Test data transformation functions
- Test chart rendering with mock data
- Test error boundary behavior
- Target: 70% code coverage minimum

**Extension (Jest)**:
- Test service worker message handling
- Test cache logic (hit/miss scenarios)
- Test whitelist management
- Test API client retry logic
- Test content script injection
- Target: 70% code coverage minimum

### Integration Testing

**Backend Integration**:
- Test complete API request/response cycle
- Test database transactions (create, read, update, delete)
- Test ML model loading and prediction pipeline
- Test threat intelligence API integration (with mocks)
- Test rate limiting behavior
- Test CORS configuration

**Dashboard Integration**:
- Test API route handlers with Prisma
- Test server-side data fetching
- Test form submissions end-to-end
- Test authentication flow (if implemented)

### End-to-End Testing (Playwright)

**Critical User Flows**:
1. **Phishing Detection Flow**:
   - User navigates to malicious URL
   - Extension intercepts navigation
   - Backend analyzes and returns block action
   - Warning overlay displayed
   - User clicks "Go Back"
   - Navigation prevented

2. **False Positive Reporting**:
   - User encounters blocked legitimate site
   - User clicks "Report False Positive"
   - Feedback submitted to backend
   - Admin reviews feedback in dashboard
   - Admin marks as confirmed false positive
   - URL added to whitelist

3. **Dashboard Monitoring**:
   - Admin opens dashboard
   - Recent scans displayed in real-time
   - Admin filters by blocked URLs
   - Admin exports data to CSV
   - Admin views analytics charts

### Performance Testing

**Load Testing (Locust or k6)**:
- Simulate 100 concurrent users
- Target: 95th percentile response time <100ms
- Target: 0% error rate under normal load
- Test rate limiting behavior (verify 429 responses)

**Stress Testing**:
- Gradually increase load until system degrades
- Identify bottlenecks (database, ML inference, API)
- Verify graceful degradation (no crashes)

### Security Testing

**Automated Security Scans**:
- Run OWASP ZAP or Burp Suite against API
- Check for SQL injection vulnerabilities
- Check for XSS vulnerabilities
- Check for CSRF vulnerabilities
- Verify CORS configuration
- Check for exposed secrets in code

**Manual Security Review**:
- Review authentication/authorization logic
- Review input validation and sanitization
- Review error messages (no information leakage)
- Review logging (no PII exposure)
- Review rate limiting implementation

### Accessibility Testing

**Automated Tools**:
- Run Lighthouse accessibility audit (target: score ≥90)
- Run axe DevTools on all dashboard pages
- Run WAVE browser extension

**Manual Testing**:
- Keyboard navigation (Tab through all interactive elements)
- Screen reader testing (NVDA on Windows, VoiceOver on macOS)
- Zoom to 200% (verify no horizontal scroll)
- Color contrast verification (all text ≥4.5:1)

### Test Data

**ML Model Test Dataset**:
- Hold out 20% of original dataset for testing
- Include edge cases (very short URLs, very long URLs, international domains)
- Include known phishing sites from PhishTank
- Include legitimate sites from Alexa Top 1000

**API Test Data**:
- Valid URLs (http, https, with/without www)
- Invalid URLs (malformed, missing protocol, special characters)
- Edge cases (empty string, very long URL, unicode characters)

**Database Test Data**:
- Seed database with 1000 sample scans
- Include mix of blocked/allowed results
- Include various confidence scores
- Include feedback records in different states

### Continuous Integration

**CI Pipeline (GitHub Actions or similar)**:
1. Run linters (flake8, eslint, prettier)
2. Run unit tests (backend, frontend, extension)
3. Run integration tests
4. Run security scans
5. Build Docker images
6. Run E2E tests against Docker containers
7. Generate coverage reports
8. Deploy to staging (if all tests pass)

**Quality Gates**:
- All tests must pass
- Code coverage ≥80% (backend), ≥70% (frontend/extension)
- No critical security vulnerabilities
- Lighthouse accessibility score ≥90
- No linter errors


## Correctness Properties

**Property-based testing is not applicable to this feature.** This NGIPS transformation is primarily an infrastructure and integration project involving:
- Service orchestration and deployment (browser extension, React backend, Next.js dashboard)
- UI rendering and user interactions
- Database CRUD operations with Prisma
- Configuration management and system integration
- ML model integration (not model training/validation)

These components are better tested using:
- **Integration tests** for service communication and database operations
- **Snapshot tests** for UI components and rendering
- **End-to-end tests** for complete user workflows
- **Unit tests** for specific business logic functions (feature extraction, ensemble voting)
- **Manual testing** for accessibility and user experience

The testing strategy section above provides comprehensive coverage for all system components using appropriate testing methodologies for each layer.

## API Specifications

### Backend API Endpoints

#### POST /v1/analyze

**Purpose**: Analyze a URL for phishing indicators

**Request**:
```json
{
  "url": "https://example.com/suspicious-page",
  "timestamp": 1705320600000,
  "extensionVersion": "1.0.0"
}
```

**Response (200 OK)**:
```json
{
  "action": "block",
  "confidence": 0.92,
  "threatLevel": "high",
  "reasons": [
    "Known phishing site in threat database",
    "Suspicious URL structure detected",
    "Domain registered recently"
  ],
  "modelVersion": "v1.0.0",
  "processingTime": 45
}
```

**Error Responses**:
- `400 Bad Request`: Invalid URL format
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Processing failure
- `503 Service Unavailable`: Models not loaded

**Rate Limiting**: 100 requests per minute per IP address

**Timeout**: 5 seconds server-side processing timeout

#### POST /v1/feedback

**Purpose**: Submit user feedback on scan results

**Request**:
```json
{
  "scanId": "scan_abc123",
  "isFalsePositive": true,
  "userComment": "This is my company's internal site"
}
```

**Response (201 Created)**:
```json
{
  "id": "feedback_xyz789",
  "scanId": "scan_abc123",
  "status": "pending",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### GET /health

**Purpose**: Health check endpoint for monitoring

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "components": {
    "database": "healthy",
    "models": "healthy",
    "threatIntel": "healthy"
  }
}
```

#### GET /metrics

**Purpose**: Performance and usage metrics

**Response (200 OK)**:
```json
{
  "uptime": 86400,
  "totalRequests": 15234,
  "averageResponseTime": 67,
  "p95ResponseTime": 95,
  "p99ResponseTime": 145,
  "errorRate": 0.002,
  "cacheHitRate": 0.73,
  "modelsLoaded": ["logistic_regression", "naive_bayes"],
  "databaseConnections": 5
}
```

### Dashboard API Routes

#### GET /api/scans

**Purpose**: Fetch scan history with pagination and filtering

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 50, max: 100)
- `result`: Filter by result ('blocked' | 'allowed')
- `startDate`: Filter by start date (ISO 8601)
- `endDate`: Filter by end date (ISO 8601)
- `minConfidence`: Minimum confidence score (0.0 to 1.0)
- `search`: Search term for URL/domain

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "scan_abc123",
      "url": "https://example.com",
      "domain": "example.com",
      "result": "blocked",
      "confidence": 0.92,
      "threatLevel": "high",
      "reasons": ["Known phishing site"],
      "timestamp": "2024-01-15T10:30:00Z",
      "modelVersion": "v1.0.0"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1523,
    "totalPages": 31
  }
}
```

#### GET /api/stats

**Purpose**: Aggregate statistics for dashboard

**Response (200 OK)**:
```json
{
  "totalScans": 15234,
  "blockedCount": 3421,
  "allowedCount": 11813,
  "blockRate": 0.224,
  "averageConfidence": 0.87,
  "falsePositiveRate": 0.018,
  "topBlockedDomains": [
    {"domain": "phishing-site.com", "count": 234},
    {"domain": "malicious-domain.net", "count": 189}
  ],
  "recentScans": [
    {
      "id": "scan_xyz789",
      "url": "https://suspicious.com",
      "result": "blocked",
      "timestamp": "2024-01-15T10:35:00Z"
    }
  ]
}
```

#### GET /api/feedback

**Purpose**: Fetch user feedback with filtering

**Query Parameters**:
- `page`: Page number
- `limit`: Records per page
- `status`: Filter by status ('pending' | 'confirmed' | 'rejected' | 'under_review')

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "feedback_abc123",
      "scanId": "scan_xyz789",
      "scan": {
        "url": "https://example.com",
        "result": "blocked",
        "confidence": 0.85
      },
      "isFalsePositive": true,
      "userComment": "This is a legitimate site",
      "status": "pending",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 87,
    "totalPages": 2
  }
}
```

#### PATCH /api/feedback/:id

**Purpose**: Update feedback status (admin action)

**Request**:
```json
{
  "status": "confirmed",
  "adminComment": "Confirmed as false positive, added to whitelist",
  "reviewedBy": "admin@example.com"
}
```

**Response (200 OK)**:
```json
{
  "id": "feedback_abc123",
  "status": "confirmed",
  "reviewedAt": "2024-01-15T10:40:00Z",
  "reviewedBy": "admin@example.com"
}
```

#### GET /api/config

**Purpose**: Fetch system configuration

**Response (200 OK)**:
```json
{
  "confidenceThreshold": 0.7,
  "rateLimitPerMinute": 100,
  "cacheEnabled": true,
  "cacheTTL": 3600,
  "threatIntelEnabled": true,
  "modelVersion": "v1.0.0",
  "logLevel": "info"
}
```

#### PATCH /api/config

**Purpose**: Update system configuration

**Request**:
```json
{
  "confidenceThreshold": 0.75,
  "rateLimitPerMinute": 150
}
```

**Response (200 OK)**:
```json
{
  "confidenceThreshold": 0.75,
  "rateLimitPerMinute": 150,
  "updatedAt": "2024-01-15T10:45:00Z",
  "updatedBy": "admin@example.com"
}
```

## Implementation Approach

### Phase 1: Backend Foundation (Weeks 1-2)

**Objective**: Establish React backend with ML model integration

**Tasks**:
1. Set up React project structure with proper directory organization
2. Implement environment variable configuration management
3. Load existing ML models (Logistic Regression, Naive Bayes) from .pkl files
4. Create `/v1/analyze` endpoint with input validation
5. Implement feature extraction pipeline (URL parsing, TLD extraction, character analysis)
6. Implement ensemble prediction logic (weighted voting)
7. Add CORS configuration for browser extension origin
8. Implement structured JSON logging
9. Add health check and metrics endpoints
10. Write unit tests for API endpoints and ML pipeline

**Deliverables**:
- Working React backend with ML inference
- API documentation (auto-generated by Express.js)
- Unit tests with ≥80% coverage
- Docker container for backend

### Phase 2: Database Layer (Week 3)

**Objective**: Add persistent storage with Prisma and SQLite

**Tasks**:
1. Set up Prisma with SQLite database
2. Define database schema (Scan, Feedback, Config, Threat, ModelMetric models)
3. Create initial database migration
4. Implement database seeding scripts with sample data
5. Integrate Prisma client into React endpoints
6. Add database logging for all scan requests
7. Implement feedback submission endpoint
8. Create database indexes for performance
9. Write integration tests for database operations
10. Set up database backup mechanism

**Deliverables**:
- SQLite database with complete schema
- Prisma migrations and seed data
- Database integration tests
- Backup/restore scripts

### Phase 3: Browser Extension (Weeks 4-5)

**Objective**: Build Manifest V3 Chrome extension for real-time protection

**Tasks**:
1. Initialize Chrome extension project with Manifest V3
2. Implement service worker for URL interception (chrome.webNavigation API)
3. Create API client with retry logic and timeout handling
4. Implement local caching mechanism (1-hour TTL)
5. Build content script for warning overlay injection
6. Design and implement warning overlay UI (HTML/CSS)
7. Create popup interface for statistics and settings
8. Implement whitelist management (add/remove domains)
9. Add user feedback submission from overlay
10. Implement offline/error handling (fail-safe behavior)
11. Write unit tests for extension logic
12. Test on Chrome, Edge, and Brave browsers

**Deliverables**:
- Working browser extension (.zip package)
- Extension icons and assets
- User documentation
- Unit tests for extension logic

### Phase 4: Next.js Dashboard (Weeks 6-7)

**Objective**: Build modern management dashboard with real-time monitoring

**Tasks**:
1. Initialize Next.js 15 project with App Router
2. Set up Prisma client for server-side data access
3. Create dashboard layout with navigation
4. Implement real-time scan monitoring page (polling every 5 seconds)
5. Build scan history page with filtering, search, and pagination
6. Create analytics page with charts (Recharts or Chart.js)
7. Implement feedback management interface
8. Build settings page for configuration management
9. Add dark mode support
10. Implement CSV export functionality
11. Write component tests with Jest/Vitest
12. Ensure WCAG 2.1 Level AA accessibility compliance

**Deliverables**:
- Working Next.js dashboard
- Responsive UI components
- Component tests
- Accessibility audit report

### Phase 5: Advanced Features (Week 8)

**Objective**: Add threat intelligence and model enhancements

**Tasks**:
1. Integrate PhishTank API for known malicious URLs
2. Integrate OpenPhish feed
3. Implement threat database caching and updates
4. Add domain reputation scoring
5. Implement SSL certificate validation (for HTTPS URLs)
6. Add uncertainty quantification for low-confidence predictions
7. Implement model versioning support
8. Create model performance monitoring dashboard
9. Add rate limiting with Redis (optional) or in-memory
10. Implement API authentication with API keys (optional)

**Deliverables**:
- Threat intelligence integration
- Enhanced ML pipeline
- Performance monitoring
- Security enhancements

### Phase 6: Integration & Testing (Week 9)

**Objective**: End-to-end integration and comprehensive testing

**Tasks**:
1. Set up Docker Compose for local development
2. Write end-to-end tests with Playwright
3. Perform load testing with Locust or k6
4. Run security scans with OWASP ZAP
5. Conduct accessibility testing (Lighthouse, axe, manual)
6. Perform cross-browser testing
7. Test offline scenarios and error handling
8. Optimize performance (caching, query optimization)
9. Fix bugs and issues found during testing
10. Update documentation

**Deliverables**:
- Docker Compose configuration
- E2E test suite
- Performance test results
- Security audit report
- Updated documentation

### Phase 7: Deployment & Documentation (Week 10)

**Objective**: Production deployment and comprehensive documentation

**Tasks**:
1. Set up CI/CD pipeline (GitHub Actions)
2. Create production Docker images
3. Write deployment guide (DEPLOYMENT.md)
4. Write development setup guide (DEVELOPMENT.md)
5. Write API documentation (API.md)
6. Write architecture documentation (ARCHITECTURE.md)
7. Create user guide for browser extension
8. Create administrator guide for dashboard
9. Write troubleshooting guide
10. Prepare browser extension for Chrome Web Store submission

**Deliverables**:
- CI/CD pipeline
- Production deployment
- Complete documentation
- Chrome Web Store listing (draft)

### Technology Migration Strategy

**From Flask to React**:
1. Keep Flask app in `legacy/` folder as reference
2. Port ML model loading logic to React
3. Rewrite `/predict` endpoint as `/v1/analyze` with enhanced features
4. Add async support for better performance
5. Maintain backward compatibility during transition (optional)

**ML Model Enhancement**:
1. Use existing trained models as baseline
2. Add ensemble voting logic (no retraining required initially)
3. Implement feature extraction improvements
4. Add model versioning for future retraining
5. Create retraining pipeline for continuous improvement

**Database Migration**:
1. No existing database to migrate (Flask app was stateless)
2. Start fresh with Prisma schema
3. Seed with sample data for testing
4. Plan for future data retention policies

### Risk Mitigation

**Technical Risks**:
1. **ML Model Performance**: Existing models may have low accuracy
   - *Mitigation*: Evaluate models on test dataset, retrain if needed, implement ensemble to improve accuracy

2. **Browser Extension Performance**: Extension may slow down browsing
   - *Mitigation*: Implement aggressive caching, optimize API calls, use debouncing, measure overhead

3. **API Response Time**: Backend may not meet <100ms target
   - *Mitigation*: Profile code, optimize feature extraction, use async processing, implement caching

4. **Database Scalability**: SQLite may not scale for high traffic
   - *Mitigation*: Start with SQLite for MVP, plan migration to PostgreSQL if needed, implement connection pooling

5. **Threat Intelligence API Limits**: External APIs may have rate limits
   - *Mitigation*: Implement local caching, use multiple providers, handle failures gracefully

**Operational Risks**:
1. **False Positives**: Blocking legitimate sites frustrates users
   - *Mitigation*: Implement confidence thresholds, allow user overrides, collect feedback, improve models

2. **False Negatives**: Missing phishing sites defeats purpose
   - *Mitigation*: Use threat intelligence as first check, implement ensemble models, monitor metrics

3. **Privacy Concerns**: Users may worry about URL tracking
   - *Mitigation*: Clear privacy policy, minimal data collection, hash URLs in logs, allow opt-out

4. **Browser Compatibility**: Extension may not work on all browsers
   - *Mitigation*: Test on Chrome, Edge, Brave, document compatibility, plan Firefox support

### Success Metrics

**Technical Metrics**:
- API response time: <100ms at 95th percentile
- Extension overhead: <50ms per page load
- Model accuracy: >95% on test dataset
- False positive rate: <2%
- System uptime: >99.5%

**User Metrics**:
- Daily active users (DAU)
- Threats blocked per day
- User feedback submission rate
- False positive reports per 1000 scans
- User satisfaction score (if survey implemented)

**Business Metrics**:
- Time to detect new phishing sites
- Reduction in successful phishing attacks
- Cost per scan (infrastructure costs)
- User retention rate

### Future Enhancements

**Short-term (3-6 months)**:
1. **WebSocket for Real-time Updates**: Replace polling with WebSocket connections for instant dashboard updates (currently uses 5-second polling)
2. **Redis Caching Layer**: Add Redis for distributed caching to improve API performance and reduce database load
3. Multi-language support for dashboard
4. Email notifications for administrators
5. Advanced analytics (geographic threat mapping, trend analysis)
6. Mobile app for iOS/Android
7. Integration with password managers

**Medium-term (6-12 months)**:
1. Deep learning models (LSTM, Transformer) for URL analysis
2. Computer vision for fake website detection (screenshot analysis)
3. Behavioral analysis for user protection
4. Multi-tenant architecture for enterprise customers
5. Public API with rate limiting and authentication
6. Multi-browser support (Firefox, Safari extensions)
7. CDN integration for static assets

**Long-term (12+ months)**:
1. Distributed architecture with microservices
2. Real-time threat intelligence sharing network
3. AI-powered threat simulation and testing
4. Blockchain-based audit logs
5. Integration with SIEM systems

## Deployment Architecture

### Development Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Machine                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Backend    │  │  Dashboard   │  │  Extension   │     │
│  │  (React)   │  │  (Next.js)   │  │  (Chrome)    │     │
│  │  Port 8000   │  │  Port 3000   │  │  Loaded      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                                │
│         └──────────────────┴────────────────────────────────┤
│                            │                                │
│                    ┌───────▼────────┐                       │
│                    │  SQLite DB     │                       │
│                    │  (ngips.db)    │                       │
│                    └────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

**Setup**:
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Dashboard
cd dashboard
npm install
npm run dev

# Extension
# Load unpacked extension in Chrome from extension/ directory
```

### Production Environment (Docker)

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Host                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Nginx Reverse Proxy                      │  │
│  │         (SSL Termination, Load Balancing)            │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│         ┌─────────┴─────────┐                               │
│         │                   │                               │
│  ┌──────▼──────┐    ┌──────▼──────┐                        │
│  │   Backend   │    │  Dashboard  │                        │
│  │  Container  │    │  Container  │                        │
│  │  (React)  │    │  (Next.js)  │                        │
│  └──────┬──────┘    └──────┬──────┘                        │
│         │                   │                               │
│         └─────────┬─────────┘                               │
│                   │                                          │
│            ┌──────▼──────┐                                  │
│            │   SQLite    │                                  │
│            │   Volume    │                                  │
│            └─────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

**Docker Compose Configuration**:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=file:/data/ngips.db
      - CORS_ORIGINS=https://dashboard.example.com,chrome-extension://*
      - LOG_LEVEL=info
    volumes:
      - ./data:/data
      - ./backend/models:/app/models
    restart: unless-stopped

  dashboard:
    build: ./dashboard
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/data/ngips.db
      - NEXT_PUBLIC_API_URL=https://api.example.com
    volumes:
      - ./data:/data
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - dashboard
    restart: unless-stopped

volumes:
  data:
```

### Cloud Deployment Options

**Option 1: AWS**
- **Backend**: ECS Fargate or EC2 with Auto Scaling
- **Dashboard**: ECS Fargate or Amplify Hosting
- **Database**: RDS (PostgreSQL) or EFS-mounted SQLite
- **CDN**: CloudFront for static assets
- **Monitoring**: CloudWatch Logs and Metrics

**Option 2: Google Cloud Platform**
- **Backend**: Cloud Run or GKE
- **Dashboard**: Cloud Run or Firebase Hosting
- **Database**: Cloud SQL (PostgreSQL) or Filestore-mounted SQLite
- **CDN**: Cloud CDN
- **Monitoring**: Cloud Logging and Monitoring

**Option 3: Self-Hosted (VPS)**
- **Provider**: DigitalOcean, Linode, Vultr
- **Setup**: Docker Compose on single VPS
- **Reverse Proxy**: Nginx with Let's Encrypt SSL
- **Monitoring**: Prometheus + Grafana
- **Backup**: Automated daily backups to object storage

### Monitoring and Observability

**Logging**:
- Structured JSON logs from all components
- Centralized log aggregation (ELK stack or Loki)
- Log retention: 30 days
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

**Metrics**:
- API response times (p50, p95, p99)
- Request rate and error rate
- ML model prediction latency
- Database query performance
- Cache hit rate
- Extension active users

**Alerting**:
- API error rate >1%
- Response time p95 >200ms
- Database connection failures
- Model loading failures
- Disk space <10% free

**Health Checks**:
- Backend: `/health` endpoint (every 30 seconds)
- Dashboard: HTTP 200 on root path
- Database: Connection test
- ML Models: Loaded and responsive

## Security Considerations

### Authentication and Authorization

**Backend API**:
- **Development**: No authentication (trusted local environment)
- **Production**: API key authentication for extension
  - Extension includes API key in `X-API-Key` header
  - Backend validates key against environment variable
  - Rate limiting per API key

**Dashboard**:
- **Development**: No authentication (optional)
- **Production**: Basic authentication or OAuth 2.0
  - Admin users only
  - Session-based authentication
  - CSRF protection enabled

### Data Protection

**In Transit**:
- HTTPS/TLS 1.3 for all API communication
- Certificate pinning in extension (optional)
- Secure WebSocket for real-time updates (if implemented)

**At Rest**:
- Database encryption (SQLite encryption extension or file-level encryption)
- Sensitive configuration in environment variables (never in code)
- API keys stored in secure key management service (AWS Secrets Manager, etc.)

**Privacy**:
- Only URLs sent to backend (no page content, cookies, or user data)
- URLs hashed in logs (store domain + path hash, not full URL)
- No PII collection without explicit consent
- Data retention policy: 90 days for scans, 180 days for feedback
- GDPR compliance: data export and deletion endpoints

### Input Validation

**Backend**:
- Validate all input parameters with Pydantic models
- Sanitize URLs before processing (remove scripts, normalize)
- Limit URL length (max 2048 characters)
- Reject malformed URLs
- Rate limiting per IP address (100 req/min)

**Dashboard**:
- Validate all form inputs client-side and server-side
- Sanitize user comments before storing
- Prevent XSS with proper escaping
- Use parameterized queries (Prisma handles this)

**Extension**:
- Validate API responses before processing
- Sanitize URLs before display
- Content Security Policy (CSP) in manifest

### Security Headers

**Backend (React)**:
```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

**Dashboard (Next.js)**:
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

### Dependency Security

**Automated Scanning**:
- Run `pip-audit` for Python dependencies
- Run `npm audit` for JavaScript dependencies
- Use Dependabot or Renovate for automated updates
- Scan Docker images with Trivy or Snyk

**Best Practices**:
- Pin dependency versions in requirements.txt and package.json
- Review security advisories before updating
- Use virtual environments (Python) and package-lock.json (Node.js)
- Minimize dependencies (only install what's needed)

### Secrets Management

**Development**:
- Use `.env` files (never commit to git)
- Provide `.env.example` with dummy values
- Document all required environment variables

**Production**:
- Use environment variables or secrets management service
- Rotate API keys regularly
- Use different keys for different environments
- Never log secrets or API keys

### Rate Limiting

**Backend**:
- 100 requests per minute per IP address
- 1000 requests per hour per IP address
- Exponential backoff for repeated violations
- Whitelist for trusted IPs (optional)

**Extension**:
- Respect backend rate limits
- Implement client-side throttling
- Cache results to reduce API calls
- Handle 429 responses gracefully

## Conclusion

This design document provides a comprehensive blueprint for transforming the Olazkid phishing detection repository into a Next-Generation Intrusion Prevention System. The architecture follows modern best practices with clear separation of concerns, API-first design, and comprehensive testing strategies.

The implementation approach is structured in seven phases over 10 weeks, with each phase delivering working, testable software. The system prioritizes performance (<100ms API response time), privacy (minimal data collection), and user experience (fail-safe behavior, clear warnings).

Key design decisions include:
- **Express.js** for high-performance async ML inference
- **Manifest V3** for modern browser extension platform
- **Next.js 15** with App Router for optimal dashboard performance
- **SQLite + Prisma** for lightweight, type-safe data persistence
- **Ensemble models** for improved accuracy over single models
- **Threat intelligence integration** for known malicious URL detection
- **Comprehensive testing** at unit, integration, and E2E levels

The system is designed to be extensible, allowing future enhancements such as deep learning models, mobile apps, and enterprise features without major architectural changes.

**Next Steps**: Review this design document, provide feedback, and proceed to implementation planning with detailed task breakdown.
