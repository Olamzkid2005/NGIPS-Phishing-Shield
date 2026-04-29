# ML Model Integration Implementation Plan

**Goal:** Replace heuristic-only detection with ML-powered phishing detection using trained Logistic Regression and MultinomialNB models, served via a Python FastAPI microservice integrated with the Express backend.

**Architecture:** Python FastAPI ML service loads .pkl models and exposes `/predict` endpoint. Express backend calls ML service, combines ML predictions with existing heuristics using weighted ensemble scoring. Extension displays red flag notifications with threat details.

**Tech Stack:** Python 3.10+, FastAPI, uvicorn, scikit-learn, joblib, Node.js Express, Chrome Extension Manifest V3

---

## File Structure

```
Olazkid-phishing-detection-software/
├── ml-service/                          # NEW - Python ML microservice
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                      # FastAPI app entry point
│   │   ├── config.py                    # Configuration settings
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── loader.py                # Model loading logic
│   │   │   └── predictor.py             # Prediction logic
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── predict.py               # /predict endpoint
│   │   │   └── health.py                # /health endpoint
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── preprocessor.py          # URL preprocessing
│   ├── models/                          # .pkl model files go here
│   │   └── .gitkeep
│   ├── scripts/
│   │   └── export_models.py             # Export models from notebooks
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_predict.py
│   │   └── test_preprocessor.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
├── backend/
│   └── src/
│       ├── utils/
│       │   ├── featureExtraction.js     # MODIFY - Add ML integration
│       │   └── mlClient.js              # NEW - ML service HTTP client
│       ├── routes/
│       │   └── analyze.js               # MODIFY - Use ensemble scoring
│       └── server.js                    # MODIFY - Add ML service config
└── extension/
    ├── popup/
    │   ├── popup.html                   # MODIFY - Add threat indicator
    │   └── popup.js                     # MODIFY - Display threat status
    ├── content/
    │   ├── content-script.js            # MODIFY - Enhanced red flag UI
    │   └── overlay.css                  # MODIFY - Red flag styles
    └── background/
        └── service-worker.js            # MODIFY - Pass ML details
```

---

## Task 1: Export Trained Models from Notebooks

**Files:**
- Create: `ml-service/scripts/export_models.py`
- Create: `ml-service/models/.gitkeep`
- Create: `ml-service/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```txt
fastapi==0.109.0
uvicorn==0.27.0
scikit-learn==1.4.0
joblib==1.3.2
pandas==2.2.0
numpy==1.26.3
pydantic==2.6.0
httpx==0.26.0
pytest==8.0.0
python-multipart==0.0.6
```

- [ ] **Step 2: Create model export script**

Create `ml-service/scripts/export_models.py` that:
1. Loads the dataset from `Dataset/phishing_site_urls Combined.csv`
2. Trains Logistic Regression pipeline (CountVectorizer + LogReg)
3. Trains MultinomialNB pipeline (CountVectorizer + MNB)
4. Exports both models to `ml-service/models/` as .pkl files
5. Exports the vectorizer separately for reuse

- [ ] **Step 3: Run export script to generate .pkl files**

```bash
cd ml-service
python scripts/export_models.py
```

Expected output:
```
Training Logistic Regression pipeline...
Logistic Regression accuracy: 0.96
Training MultinomialNB pipeline...
MultinomialNB accuracy: 0.95
Models exported to ml-service/models/
  - logistic_regression_pipeline.pkl
  - multinomial_nb_pipeline.pkl
  - vectorizer.pkl
```

- [ ] **Step 4: Verify .pkl files exist**

```bash
ls ml-service/models/*.pkl
```

Expected: 3 .pkl files present

---

## Task 2: Create Python ML Microservice

**Files:**
- Create: `ml-service/app/__init__.py`
- Create: `ml-service/app/config.py`
- Create: `ml-service/app/main.py`
- Create: `ml-service/app/models/__init__.py`
- Create: `ml-service/app/models/loader.py`
- Create: `ml-service/app/models/predictor.py`
- Create: `ml-service/app/routes/__init__.py`
- Create: `ml-service/app/routes/predict.py`
- Create: `ml-service/app/routes/health.py`
- Create: `ml-service/app/utils/__init__.py`
- Create: `ml-service/app/utils/preprocessor.py`

- [ ] **Step 1: Create config.py**

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

MODEL_FILES = {
    "logistic_regression": MODELS_DIR / "logistic_regression_pipeline.pkl",
    "multinomial_nb": MODELS_DIR / "multinomial_nb_pipeline.pkl",
}

ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", "8001"))
ENSEMBLE_WEIGHTS = {"logistic_regression": 0.6, "multinomial_nb": 0.4, "heuristic": 0.3}
```

- [ ] **Step 2: Create model loader**

Create `ml-service/app/models/loader.py` that:
1. Loads all .pkl models at startup
2. Caches loaded models in memory
3. Validates model files exist before loading
4. Returns loaded model pipeline for predictions

- [ ] **Step 3: Create URL preprocessor**

Create `ml-service/app/utils/preprocessor.py` that:
1. Takes raw URL string
2. Applies same tokenization + stemming as training (RegexpTokenizer + SnowballStemmer)
3. Returns preprocessed text ready for CountVectorizer

- [ ] **Step 4: Create predictor module**

Create `ml-service/app/models/predictor.py` that:
1. Takes preprocessed URL
2. Runs prediction through all loaded models
3. Returns prediction probabilities (phishing probability 0-1)
4. Handles model loading errors gracefully

- [ ] **Step 5: Create predict route**

Create `ml-service/app/routes/predict.py` with:
- `POST /predict` - Accept `{"url": "..."}`, return `{"is_phishing": bool, "confidence": float, "model_scores": {...}}`
- Input validation (URL length, format)
- Error handling with appropriate HTTP status codes

- [ ] **Step 6: Create health route**

Create `ml-service/app/routes/health.py` with:
- `GET /health` - Return model status, loaded models list, uptime

- [ ] **Step 7: Create FastAPI main app**

Create `ml-service/app/main.py` that:
1. Initializes FastAPI app
2. Loads models at startup (lifespan event)
3. Includes predict and health routers
4. Adds CORS middleware for backend communication
5. Adds request logging middleware

- [ ] **Step 8: Test ML service locally**

```bash
cd ml-service
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Test with curl:
```bash
curl -X POST http://localhost:8001/predict \
  -H "Content-Type: application/json" \
  -d '{"url": "http://login-verify-account.suspicious.xyz/secure"}'
```

Expected response:
```json
{
  "is_phishing": true,
  "confidence": 0.92,
  "model_scores": {
    "logistic_regression": 0.94,
    "multinomial_nb": 0.89
  }
}
```

---

## Task 3: Integrate ML Service with Express Backend

**Files:**
- Create: `backend/src/utils/mlClient.js`
- Modify: `backend/src/utils/featureExtraction.js`
- Modify: `backend/src/routes/analyze.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Create ML service HTTP client**

Create `backend/src/utils/mlClient.js` that:
1. Makes HTTP POST requests to ML service `/predict` endpoint
2. Implements retry logic with exponential backoff (3 retries)
3. Implements circuit breaker pattern (open after 5 failures, half-open after 30s)
4. Returns parsed response or null on failure
5. Logs ML service calls and latency

```javascript
// Key exports:
export async function getMLPrediction(url) { ... }
export function getMLServiceHealth() { ... }
```

- [ ] **Step 2: Modify featureExtraction.js for ensemble scoring**

Modify `backend/src/utils/featureExtraction.js` to:
1. Import `mlClient.js`
2. Create new `analyzeUrlEnsemble(url)` async function
3. Run heuristic analysis AND ML prediction in parallel (Promise.all)
4. Combine scores using weighted ensemble:
   - If ML service unavailable, fall back to heuristic only
   - If ML available: `ensemble_score = (heuristic * 0.3) + (ml_score * 0.7)`
5. Generate combined reasons from both systems
6. Export both `analyzeUrl` (legacy) and `analyzeUrlEnsemble` (new)

- [ ] **Step 3: Update analyze route to use ensemble**

Modify `backend/src/routes/analyze.js` to:
1. Import `analyzeUrlEnsemble` from featureExtraction.js
2. Change `analyzeUrlHandler` to call `analyzeUrlEnsemble` instead of `analyzeUrl`
3. Add ML model info to response: `mlModelVersion`, `mlConfidence`, `heuristicConfidence`
4. Update `modelVersion` to include both versions

- [ ] **Step 4: Update server.js configuration**

Modify `backend/src/server.js` to:
1. Add ML_SERVICE_URL environment variable support
2. Add `/v1/models/status` endpoint to check ML service health
3. Log ML service availability at startup

- [ ] **Step 5: Test ensemble integration**

```bash
cd backend
npm run dev
```

Test endpoint:
```bash
curl -X POST http://localhost:8000/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "http://login-verify-account.suspicious.xyz/secure"}'
```

Expected response includes ML scores:
```json
{
  "id": "scan_abc123",
  "url": "http://login-verify-account.suspicious.xyz/secure",
  "action": "block",
  "confidence": 0.91,
  "threatLevel": "critical",
  "reasons": [
    "Contains suspicious keywords: login, verify, secure",
    "Suspicious top-level domain",
    "ML model high confidence (94.2%)"
  ],
  "mlModelVersion": "1.0.0",
  "mlConfidence": 0.92,
  "heuristicConfidence": 0.85,
  "modelVersion": "ensemble-1.0.0"
}
```

---

## Task 4: Add Red Flag Notifications to Extension

**Files:**
- Modify: `extension/background/service-worker.js`
- Modify: `extension/popup/popup.html`
- Modify: `extension/popup/popup.js`
- Modify: `extension/content/content-script.js`
- Modify: `extension/content/overlay.css`

- [ ] **Step 1: Update service-worker.js to pass ML details**

Modify `extension/background/service-worker.js` to:
1. Pass ML confidence and model scores in BLOCK_WARNING message
2. Add threat level color coding (low=green, medium=yellow, high=orange, critical=red)
3. Add real-time badge text updates (show threat count on extension icon)

```javascript
// Update the BLOCK_WARNING message to include:
{
  type: 'BLOCK_WARNING',
  url: url,
  threatType: result.threat_type,
  confidence: result.confidence,
  mlConfidence: result.ml_confidence,
  threatLevel: result.threat_level,
  redFlags: result.reasons
}
```

- [ ] **Step 2: Update content-script.js with enhanced red flag UI**

Modify `extension/content/content-script.js` to:
1. Add red flag indicators to the overlay (animated warning icons)
2. Display individual red flags as a list with severity indicators
3. Add threat level badge (color-coded)
4. Add ML confidence bar visualization
5. Add "Report False Positive" button

- [ ] **Step 3: Update overlay.css with red flag styles**

Modify `extension/content/overlay.css` to add:
1. Red flag list styles with severity colors
2. Threat level badge styles (green/yellow/orange/red)
3. Confidence bar animation
4. Animated warning icon pulse effect
5. Responsive layout for different screen sizes

- [ ] **Step 4: Update popup.html with threat indicator**

Modify `extension/popup/popup.html` to add:
1. Current page threat status indicator (green checkmark / red warning)
2. Recent red flags section
3. ML model status indicator
4. Quick scan button for current page

- [ ] **Step 5: Update popup.js with threat display logic**

Modify `extension/popup/popup.js` to:
1. Query current tab URL and check threat status
2. Display red flags for current page
3. Show ML model health status
4. Handle quick scan button click
5. Update threat indicator color based on confidence level

- [ ] **Step 6: Test red flag notifications**

1. Load extension in Chrome (developer mode)
2. Navigate to a test phishing URL
3. Verify:
   - Red flag overlay appears with threat details
   - Individual red flags listed with severity
   - Threat level badge shows correct color
   - ML confidence bar displays correctly
   - "Go Back" and "Proceed Anyway" buttons work
   - Popup shows current page threat status

---

## Task 5: Add Model Monitoring and Drift Detection

**Files:**
- Create: `ml-service/app/monitoring/__init__.py`
- Create: `ml-service/app/monitoring/drift_detector.py`
- Create: `ml-service/app/monitoring/metrics.py`
- Modify: `ml-service/app/routes/predict.py`

- [ ] **Step 1: Create drift detector**

Create `ml-service/app/monitoring/drift_detector.py` that:
1. Tracks prediction distribution over time (rolling window)
2. Calculates Population Stability Index (PSI) for drift detection
3. Alerts when PSI > 0.2 (significant drift)
4. Logs drift metrics for analysis

- [ ] **Step 2: Create metrics collector**

Create `ml-service/app/monitoring/metrics.py` that:
1. Tracks prediction latency (p50, p95, p99)
2. Tracks prediction counts by class (phishing/legitimate)
3. Tracks model confidence distribution
4. Exposes metrics via `/metrics` endpoint

- [ ] **Step 3: Integrate monitoring into predict route**

Modify `ml-service/app/routes/predict.py` to:
1. Log each prediction with timestamp, URL hash, confidence
2. Update drift detector with each prediction
3. Record latency metrics
4. Log alerts when drift detected

- [ ] **Step 4: Test monitoring**

```bash
# Send 100 test requests
for i in {1..100}; do
  curl -X POST http://localhost:8001/predict \
    -H "Content-Type: application/json" \
    -d '{"url": "http://test'$i'.example.com"}'
done

# Check metrics
curl http://localhost:8001/metrics
```

---

## Task 6: Create Model Retraining Pipeline

**Files:**
- Create: `ml-service/scripts/retrain.py`
- Create: `ml-service/scripts/evaluate.py`
- Modify: `ml-service/app/main.py`

- [ ] **Step 1: Create retrain script**

Create `ml-service/scripts/retrain.py` that:
1. Loads latest dataset (including user feedback data)
2. Splits into train/validation/test sets
3. Trains both models with hyperparameter tuning
4. Evaluates on test set
5. If accuracy > threshold, exports new models with version timestamp
6. Logs training metrics to MLflow or local JSON

- [ ] **Step 2: Create evaluation script**

Create `ml-service/scripts/evaluate.py` that:
1. Loads current production model
2. Loads test dataset
3. Calculates: accuracy, precision, recall, F1, ROC-AUC
4. Generates confusion matrix
5. Outputs classification report

- [ ] **Step 3: Add retrain endpoint**

Modify `ml-service/app/main.py` to add:
- `POST /retrain` - Trigger model retraining (admin only)
- `GET /models/versions` - List available model versions
- `POST /models/rollback` - Rollback to previous model version

- [ ] **Step 4: Test retraining pipeline**

```bash
cd ml-service
python scripts/retrain.py --data-path ../Dataset/phishing_site_urls\ Combined.csv
python scripts/evaluate.py
```

---

## Task 7: Dockerize ML Service

**Files:**
- Create: `ml-service/Dockerfile`
- Create: `docker-compose.yml` (at project root)

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY models/ ./models/

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:8001/health || exit 1

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

- [ ] **Step 2: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  ml-service:
    build: ./ml-service
    ports:
      - "8001:8001"
    volumes:
      - ./ml-service/models:/app/models
    environment:
      - ML_SERVICE_HOST=0.0.0.0
      - ML_SERVICE_PORT=8001
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - ML_SERVICE_URL=http://ml-service:8001
      - PORT=8000
    depends_on:
      ml-service:
        condition: service_healthy
```

- [ ] **Step 3: Test Docker deployment**

```bash
docker-compose up --build
docker-compose ps  # Both services should be healthy
```

---

## Task 8: Write Tests

**Files:**
- Create: `ml-service/tests/__init__.py`
- Create: `ml-service/tests/test_predict.py`
- Create: `ml-service/tests/test_preprocessor.py`
- Create: `backend/src/utils/__tests__/mlClient.test.js`

- [ ] **Step 1: Write ML service tests**

Create `ml-service/tests/test_predict.py`:
- Test prediction with known phishing URL
- Test prediction with known legitimate URL
- Test prediction with malformed URL
- Test prediction latency < 100ms
- Test ensemble score calculation

- [ ] **Step 2: Write preprocessor tests**

Create `ml-service/tests/test_preprocessor.py`:
- Test tokenization matches training pipeline
- Test stemming matches training pipeline
- Test URL with special characters
- Test URL with unicode characters

- [ ] **Step 3: Write backend ML client tests**

Create `backend/src/utils/__tests__/mlClient.test.js`:
- Test successful ML service call
- Test ML service timeout handling
- Test circuit breaker pattern
- Test retry logic

- [ ] **Step 4: Run all tests**

```bash
# ML service tests
cd ml-service
pytest tests/ -v

# Backend tests
cd backend
npm test
```

---

## Execution Order

1. **Task 1** - Export models (generates .pkl files)
2. **Task 2** - Create ML service (standalone, testable)
3. **Task 3** - Integrate with backend (ensemble scoring)
4. **Task 4** - Update extension UI (red flag notifications)
5. **Task 5** - Add monitoring (production readiness)
6. **Task 6** - Add retraining pipeline (MLOps)
7. **Task 7** - Dockerize (deployment)
8. **Task 8** - Write tests (verification)

---

## Success Criteria

- [ ] ML service loads .pkl models and returns predictions in < 100ms
- [ ] Backend ensemble scoring combines ML + heuristic scores
- [ ] Extension displays red flag notifications with threat details
- [ ] Model monitoring detects drift (PSI > 0.2)
- [ ] Retraining pipeline produces new models with accuracy > 95%
- [ ] All tests pass
- [ ] Docker deployment works
- [ ] End-to-end flow: Extension → Backend → ML Service → Response → Red Flag UI
