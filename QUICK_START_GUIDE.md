# Quick Start Guide: NGIPS Transformation
## Get Started in 30 Minutes

---

## 🎯 What We're Building

Transform your Flask phishing detector into a **production-ready NGIPS** with:
- ⚡ FastAPI backend (10x faster than Flask)
- 🔌 Browser extension (real-time protection)
- 📊 Next.js dashboard (modern UI)
- 💾 SQLite + Prisma (persistent storage)

---

## 📋 Prerequisites

### Required Software
```bash
# Check if you have these installed:
python --version    # Need 3.9+
node --version      # Need 18+
npm --version       # Need 9+
git --version       # Any recent version
```

### Install Missing Tools
```bash
# Python (if needed)
# Download from: https://www.python.org/downloads/

# Node.js (if needed)
# Download from: https://nodejs.org/

# Git (if needed)
# Download from: https://git-scm.com/
```

---

## 🚀 Phase 1: FastAPI Backend (Start Here!)

### Step 1: Create Backend Structure

```bash
# Navigate to your project
cd "Olazkid-phishing-detection-software"

# Create backend folder structure
mkdir -p backend/app/api/v1/endpoints
mkdir -p backend/app/core
mkdir -p backend/app/ml
mkdir -p backend/app/db
mkdir -p backend/models
mkdir -p backend/tests
```

### Step 2: Set Up Python Environment

```bash
# Create virtual environment
python -m venv backend/venv

# Activate it (Windows)
backend\venv\Scripts\activate

# Activate it (Mac/Linux)
source backend/venv/bin/activate
```

### Step 3: Install Dependencies

Create `backend/requirements.txt`:
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
scikit-learn==1.3.2
joblib==1.3.2
numpy==1.26.2
pandas==2.1.3
python-multipart==0.0.6
python-dotenv==1.0.0
prisma==0.11.0
```

Install:
```bash
pip install -r backend/requirements.txt
```

### Step 4: Create FastAPI Application

Create `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title="NGIPS Phishing Detection API",
    description="AI-powered phishing detection engine",
    version="1.0.0"
)

# CORS for browser extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "NGIPS Phishing Detection API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### Step 5: Create Configuration

Create `backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "NGIPS Phishing Detection"
    
    # Model Settings
    MODEL_PATH: str = "../models"
    LOGISTIC_MODEL: str = "logistic_regression.pkl"
    NAIVE_BAYES_MODEL: str = "naive_bayes.pkl"
    
    # Database
    DATABASE_URL: str = "file:../database/ngips.db"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### Step 6: Create ML Inference Module

Create `backend/app/ml/inference.py`:
```python
import joblib
import numpy as np
from pathlib import Path
from typing import Dict, List
import re
from urllib.parse import urlparse

class PhishingDetector:
    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load the trained model"""
        try:
            model_file = self.model_path / "phishingApp.pkl"
            self.model = joblib.load(model_file)
            print(f"✅ Model loaded from {model_file}")
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            raise
    
    def extract_features(self, url: str) -> Dict[str, float]:
        """Extract features from URL"""
        parsed = urlparse(url)
        
        features = {
            "url_length": len(url),
            "domain_length": len(parsed.netloc),
            "path_length": len(parsed.path),
            "has_ip": int(bool(re.match(r'\d+\.\d+\.\d+\.\d+', parsed.netloc))),
            "has_at": int('@' in url),
            "has_double_slash": int('//' in parsed.path),
            "num_dots": url.count('.'),
            "num_hyphens": url.count('-'),
            "num_underscores": url.count('_'),
            "num_digits": sum(c.isdigit() for c in url),
            "has_https": int(parsed.scheme == 'https'),
        }
        
        return features
    
    def predict(self, url: str) -> Dict[str, any]:
        """Predict if URL is phishing"""
        try:
            # Use the model's predict method
            prediction = self.model.predict([url])[0]
            
            # Get probability if available
            try:
                proba = self.model.predict_proba([url])[0]
                confidence = float(max(proba))
            except:
                confidence = 0.85  # Default confidence
            
            is_phishing = bool(prediction == 1)
            
            return {
                "url": url,
                "is_phishing": is_phishing,
                "confidence": confidence,
                "action": "block" if is_phishing else "allow",
                "threat_level": self._get_threat_level(confidence, is_phishing)
            }
        except Exception as e:
            print(f"Prediction error: {e}")
            return {
                "url": url,
                "is_phishing": False,
                "confidence": 0.0,
                "action": "allow",
                "error": str(e)
            }
    
    def _get_threat_level(self, confidence: float, is_phishing: bool) -> str:
        """Determine threat level"""
        if not is_phishing:
            return "safe"
        if confidence > 0.9:
            return "critical"
        elif confidence > 0.7:
            return "high"
        else:
            return "medium"

# Global detector instance
detector = None

def get_detector(model_path: str = "../models") -> PhishingDetector:
    """Get or create detector instance"""
    global detector
    if detector is None:
        detector = PhishingDetector(model_path)
    return detector
```

### Step 7: Create API Endpoint

Create `backend/app/api/v1/endpoints/analyze.py`:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional
from app.ml.inference import get_detector
import time

router = APIRouter()

class URLAnalysisRequest(BaseModel):
    url: str
    user_id: Optional[str] = None

class URLAnalysisResponse(BaseModel):
    url: str
    is_phishing: bool
    confidence: float
    action: str
    threat_level: str
    analysis_time_ms: float
    timestamp: str

@router.post("/analyze", response_model=URLAnalysisResponse)
async def analyze_url(request: URLAnalysisRequest):
    """
    Analyze a URL for phishing threats
    
    - **url**: The URL to analyze
    - **user_id**: Optional user identifier for logging
    """
    start_time = time.time()
    
    try:
        # Get detector instance
        detector = get_detector()
        
        # Perform analysis
        result = detector.predict(request.url)
        
        # Calculate analysis time
        analysis_time = (time.time() - start_time) * 1000
        
        # Add metadata
        result["analysis_time_ms"] = round(analysis_time, 2)
        result["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@router.get("/stats")
async def get_stats():
    """Get API statistics"""
    return {
        "total_scans": 0,  # TODO: Implement with database
        "blocked_threats": 0,
        "uptime": "100%",
        "model_version": "1.0.0"
    }
```

### Step 8: Create API Router

Create `backend/app/api/v1/router.py`:
```python
from fastapi import APIRouter
from app.api.v1.endpoints import analyze

api_router = APIRouter()

api_router.include_router(
    analyze.router,
    tags=["analysis"]
)
```

### Step 9: Copy Your Model

```bash
# Copy your trained model to the backend
cp phishingApp.pkl backend/models/
```

### Step 10: Run the API!

```bash
# Make sure you're in the backend directory
cd backend

# Run with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 11: Test It!

Open your browser and go to:
- http://localhost:8000 - API info
- http://localhost:8000/docs - Interactive API documentation
- http://localhost:8000/health - Health check

Test the API:
```bash
# Using curl (Windows PowerShell)
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/analyze" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"url": "http://suspicious-site.com"}'

# Using curl (Mac/Linux)
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://suspicious-site.com"}'
```

---

## ✅ Success Checklist

After completing Phase 1, you should have:
- ✅ FastAPI running on http://localhost:8000
- ✅ Interactive docs at http://localhost:8000/docs
- ✅ `/api/v1/analyze` endpoint working
- ✅ ML model loaded and making predictions
- ✅ Response time < 100ms

---

## 🎉 What's Next?

You've completed **Phase 1: Backend Modernization**!

### Next Steps:
1. **Phase 2: Database Layer** - Add SQLite + Prisma for persistence
2. **Phase 3: Browser Extension** - Build the real-time sensor
3. **Phase 4: Next.js Dashboard** - Create the management UI

### Want to Continue?

Choose your path:
- 🗄️ **Add Database** → See `DATABASE_SETUP.md`
- 🔌 **Build Extension** → See `EXTENSION_GUIDE.md`
- 📊 **Create Dashboard** → See `DASHBOARD_GUIDE.md`

---

## 🐛 Troubleshooting

### Model Not Loading
```bash
# Check if model file exists
ls backend/models/phishingApp.pkl

# If missing, copy from root
cp phishingApp.pkl backend/models/
```

### Port Already in Use
```bash
# Use a different port
uvicorn app.main:app --reload --port 8001
```

### Import Errors
```bash
# Make sure you're in the backend directory
cd backend

# Reinstall dependencies
pip install -r requirements.txt
```

### CORS Errors
- Check that CORS middleware is configured in `main.py`
- Verify `allow_origins` includes your frontend URL

---

## 📚 Additional Resources

- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
- [Pydantic Models](https://docs.pydantic.dev/)

---

**🎊 Congratulations! You've modernized your backend to FastAPI!**

Ready to add the database layer? Check out `DATABASE_SETUP.md` next!
