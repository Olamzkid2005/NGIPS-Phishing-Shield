# Development Guide

## Prerequisites
- Python 3.10+
- Node.js 18+

## Setup

### Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Unix: source venv/bin/activate
pip install -r requirements.txt

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start server
uvicorn app.main:app --reload
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### Chrome Extension
1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/` directory

## Testing
```bash
# Backend tests
pytest

# Frontend tests
npm run test
```