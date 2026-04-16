# NGIPS Phishing Detection System

Next-Generation Intrusion Prevention System (NGIPS) for real-time phishing detection and prevention.

## 🚀 Project Status

This project is currently undergoing a major architectural transformation from a standalone Flask application to a comprehensive NGIPS with three main components:

1. **AI_Inspection_Engine** - FastAPI backend with ML-based phishing detection
2. **Sensor** - Manifest V3 Chrome extension for real-time URL interception
3. **Management_Dashboard** - Next.js 15 dashboard for monitoring and analytics

## 📁 Repository Structure

```
├── backend/              # FastAPI AI Inspection Engine (in development)
├── extension/            # Browser Extension Sensor (in development)
├── dashboard/            # Next.js Management Dashboard (in development)
├── Dataset/              # Training datasets for ML models
├── legacy/               # ⚠️ Archived Flask application (no longer maintained)
│   ├── Code/            # Original Flask app code
│   ├── static/          # Flask static assets
│   └── templates/       # Flask HTML templates
├── .kiro/specs/         # Implementation specifications
└── phishingApp*.pkl     # Trained ML models (Logistic Regression, Naive Bayes)
```

## ⚠️ Legacy Flask Application

The original Flask-based phishing detection application has been **archived** to the `legacy/` directory and is **no longer maintained**. 

- **Location**: `legacy/Code/app.py`
- **Status**: Archived (read-only reference)
- **Reason**: Replaced by modern NGIPS architecture with FastAPI, browser extension, and Next.js dashboard

If you need to reference the original Flask implementation, you can find it in the `legacy/` folder. However, all new development should focus on the NGIPS components.

## 📖 Documentation

- **[Transformation Roadmap](TRANSFORMATION_ROADMAP.md)** - Complete migration plan from Flask to NGIPS
- **[Architecture Plan](NGIPS_Architecture_Plan_Extracted.md)** - System architecture and design
- **[Quick Start Guide](QUICK_START_GUIDE.md)** - Getting started with development
- **[Implementation Spec](.kiro/specs/ngips-transformation-with-ai/)** - Detailed requirements, design, and tasks

## 🛠️ Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev
```

### Extension (Chrome)
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory

## 🎯 Key Features (Planned)

- ✅ Real-time phishing detection via browser extension
- ✅ ML-based URL analysis with ensemble models
- ✅ Threat intelligence integration (PhishTank, OpenPhish)
- ✅ Modern management dashboard with analytics
- ✅ User feedback system for continuous improvement
- ✅ Comprehensive logging and monitoring

## 📊 Performance Targets

- API response time: <100ms (95th percentile)
- Extension overhead: <50ms per page load
- Model accuracy: >95%
- False positive rate: <2%

## 🤝 Contributing

This project is currently in active development. Please refer to the implementation spec in `.kiro/specs/ngips-transformation-with-ai/` for current tasks and progress.

## 📄 License

[Add your license here]

---

**Note**: This is a work in progress. The NGIPS architecture is being implemented according to the transformation roadmap. Check the spec documents for current implementation status.
