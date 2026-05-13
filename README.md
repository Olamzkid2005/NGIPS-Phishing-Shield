# NGIPS Phishing Shield

Next-Generation Intrusion Prevention System for real-time phishing detection and prevention.

**Architecture:**
- **Backend** — Express.js API (Prisma/SQLite, Rate limiting, Auth)
- **Dashboard** — Next.js 15 App Router (Tailwind CSS, Recharts, Zustand)
- **ML** — ONNX Runtime in Node.js (Logistic Regression + Naive Bayes ensemble)
- **Extension** — Manifest V3 Chrome extension (webNavigation interception)

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Backend
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### ML Models
```bash
# Train models (optional - pre-trained ONNX models included)
cd ml-service
pip install -r requirements.txt
python scripts/train.py
python scripts/export_to_onnx.py

# Evaluate
python scripts/evaluate.py --data ../Dataset/phishing_site_urls\ Combined.csv --model models/logistic_regression_pipeline.pkl

# Adversarial robustness test
python scripts/adversarial_test.py
```

### Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory

## Repository Structure

```
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── server.js           # Express app entry (port 8000)
│   │   ├── routes/             # API route handlers
│   │   ├── utils/              # Core modules:
│   │   │   ├── onnxInference.js   # ONNX model inference
│   │   │   ├── vectorizer.js      # URL → bag-of-words (vocabulary: 392K)
│   │   │   ├── stemmer.js         # Porter2/Snowball stemmer
│   │   │   ├── featureExtraction.js  # Heuristic URL features
│   │   │   ├── monitoring.js      # PSI drift detection
│   │   │   ├── feedbackRepository.js # Feedback with Prisma persistence
│   │   │   ├── featureStore.js    # 32-feature registry
│   │   │   └── ...
│   │   ├── prisma/             # Schema + SQLite DB
│   └── e2e/                    # End-to-end tests
│
├── dashboard/                  # Next.js 15 App Router
│   ├── app/                    # App Router pages
│   │   ├── page.tsx            # Dashboard
│   │   ├── analyzer/page.tsx   # URL Analyzer
│   │   ├── history/page.tsx    # Scan History
│   │   ├── analytics/page.tsx  # Analytics & Trends
│   │   ├── feedback/page.tsx   # Feedback Management
│   │   └── settings/page.tsx   # Settings
│   └── src/
│       ├── components/         # UI components
│       ├── services/api.ts     # Axios API client
│       └── store/index.ts      # Zustand state
│
├── extension/                 # Manifest V3 Chrome extension
│   ├── background/            # Service worker
│   ├── content/               # Content scripts + overlay
│   └── popup/                 # Extension popup UI
│
├── ml-service/                # ML training & evaluation
│   ├── scripts/
│   │   ├── train.py           # Full training pipeline
│   │   ├── retrain.py         # Retrain with feedback data
│   │   ├── evaluate.py        # Model evaluation
│   │   ├── features.py        # Python feature extraction
│   │   ├── deep_learning.py   # CNN baseline
│   │   ├── adversarial_test.py  # Robustness tests
│   │   ├── model_registry.py  # Version management
│   │   └── export_models.py   # Legacy model export
│   └── models/                # ONNX + .pkl model files
│
├── Dataset/                   # Training data (629K URLs)
└── docker-compose.yml         # Production deployment
```

## ML Architecture

```
User URL
    │
    ▼
featureExtraction.js (heuristic — 31 features)
    │
    ├── URL length, domain length, path depth
    ├── Character counts (special, digit, letter, uppercase)
    ├── Shannon entropy (hostname)
    ├── Suspicious TLD detection
    ├── Suspicious keyword detection
    └── Binary flags (hasIP, hasPort, atSymbol, etc.)
    │
    ▼
onnxInference.js (ensemble — 2 ONNX models)
    │
    ├── Logistic Regression (60% weight)
    │   └── Bag-of-words via CountVectorizer (392K vocab)
    └── Multinomial Naive Bayes (40% weight)
        └── Bag-of-words via CountVectorizer (392K vocab)
    │
    ▼
Final confidence (0.0 - 1.0) + threat level (low/medium/high/critical)
```

**Ensemble formula:** `0.6 × LR(URL) + 0.4 × NB(URL)`
- **With ML available:** `30% heuristic + 70% ensemble`
- **Without ML:** `100% heuristic`

## API Endpoints (port 8000)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/analyze` | Extension/Bearer | Analyze URL for phishing |
| GET | `/v1/scans` | Extension/Bearer | Paginated scan history |
| GET | `/v1/scans/:id` | Extension/Bearer | Single scan detail |
| POST | `/v1/feedback` | Extension/Bearer | Submit scan feedback |
| GET | `/v1/stats` | Extension/Bearer | Aggregate statistics |
| GET | `/v1/analytics/trends` | Extension/Bearer | Daily/weekly trend data |
| GET | `/v1/analytics/top-domains` | Extension/Bearer | Top blocked domains |
| GET | `/v1/analytics/threats` | Extension/Bearer | Threat classification |
| GET/PATCH | `/v1/settings` | Bearer | Dashboard settings |
| POST | `/v1/auth/login` | Public | Login (demo: demo@example.com/demo123) |
| POST | `/v1/auth/refresh` | Public | Refresh access token |
| POST | `/v1/auth/logout` | Public | Logout |
| GET | `/v1/auth/me` | Bearer | Current user info |
| POST | `/v1/admin/calibrate` | API Key | Set drift detection baseline |
| POST | `/v1/admin/retrain` | API Key | Trigger model retraining |
| POST | `/v1/admin/clear-history` | API Key | Clear all scan history |
| GET | `/v1/admin/alerts` | API Key | Recent monitoring alerts |
| POST | `/v1/admin/evaluate` | API Key | Evaluate model metrics |
| POST | `/v1/admin/models/candidate` | API Key | Deploy canary model |
| POST | `/v1/admin/models/promote` | API Key | Promote canary to active |
| POST | `/v1/admin/models/rollback` | API Key | Rollback to default |
| POST | `/v1/admin/models/traffic-split` | API Key | Set canary % |
| GET | `/v1/admin/models/status` | API Key | Model registry status |
| GET | `/v1/admin/feedback/export` | API Key | Export feedback CSV |

## Docker Deployment

```bash
docker-compose up --build
```

- Backend API: `http://localhost:8000`
- Dashboard: `http://localhost:3000`

## Environment Variables

### Backend
```
JWT_SECRET=your-secret-key
ADMIN_API_KEY=your-admin-key
DATABASE_URL=file:./dev.db
PORT=8000
NODE_ENV=production
AUTO_RETRAIN_ENABLED=true
```

### Dashboard
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Key Features

- **Real-time phishing detection** — Browser extension intercepts navigation
- **Hybrid ML** — Ensemble: Logistic Regression + Naive Bayes + 31 heuristic features
- **Probability calibration** — Platt scaling via CalibratedClassifierCV
- **Drift detection** — PSI-based monitoring with auto-retrain trigger
- **Canary deployment** — Route 5% traffic to candidate models for A/B testing
- **Model versioning** — Registry with promote/rollback/cleanup commands
- **Adversarial testing** — Typosquatting, homoglyph, shortener detection
- **Deep learning baseline** — Character-level CNN with heuristic feature fusion
- **Production monitoring** — Latency percentiles (p50/p95/p99), confidence distribution
