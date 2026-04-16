# AI-Powered NGIPS Architecture
## Phishing Detection & Prevention System Plan

---

## Executive Summary

This document outlines the architectural transformation of a standalone phishing detection repository into a modern, **Next-Generation Intrusion Prevention System (NGIPS)**. The system leverages a browser-based sensor, an AI-driven inspection core, and a Next.js management dashboard to provide real-time protection against malicious web threats.

---

## System Components

### 1. The Sensor: Browser Extension

A **Manifest V3 browser extension** acting as the inline inspection point. It intercepts network requests before they are fully rendered.

**Features:**
- ✔ **Traffic Interception:** Monitors URL updates and navigation events
- ✔ **Active Prevention:** Injects a DOM-based overlay to block access to flagged sites
- ✔ **Low Latency:** Asynchronous communication with the core engine

---

### 2. The Core: AI Inspection Engine (FastAPI)

The centralized brain of the NGIPS. It wraps existing machine learning models into a high-performance API.

**Features:**
- ✔ **Ensemble Modeling:** Combines Logistic Regression and Naive Bayes for cross-validated scoring
- ✔ **Heuristic Extraction:** Analyzes URL structural features (TLD, length, character distribution)
- ✔ **Persistence:** Logs every transaction to a shared SQLite database

---

### 3. Management: Next.js Dashboard

A modern React-based interface for system administration and log visualization.

**Features:**
- ✔ **Real-time Monitoring:** Displays live scan results
- ✔ **Feedback Loop:** Allows users to mark false positives/negatives
- ✔ **Security Metrics:** Visualizes threat trends and model accuracy stats

---

## Technical Stack

| Layer | Technology | Implementation Detail |
|-------|-----------|----------------------|
| **Frontend** | Next.js 15 | React Server Components for direct DB access |
| **Backend** | FastAPI | Uvicorn ASGI server for high-speed ML inference |
| **AI/ML** | Scikit-learn | Joblib-serialized models for instant loading |
| **Storage** | SQLite + Prisma | Shared database for logs and configuration |
| **Sensor** | Javascript | Chrome Extension Manifest V3 (Background Service Workers) |

---

## Data Flow Logic

1. **Intercept:** User navigates to a URL; Browser Extension catches the URL
2. **Analysis:** URL is sent to FastAPI `/v1/analyze` endpoint
3. **Inference:** AI Core runs feature extraction and model prediction
4. **Log:** Result is stored in `ngips.db`
5. **Response:** Extension receives `{ "action": "block" }` or `{ "action": "allow" }`
6. **Visualize:** Next.js Dashboard updates the UI via server-side polling

---

## Architecture Diagram

```
┌─────────────────┐
│  Browser User   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Browser Extension      │
│  (Manifest V3 Sensor)   │
└────────┬────────────────┘
         │ HTTP Request
         ▼
┌─────────────────────────┐
│  FastAPI Core Engine    │
│  (ML Inference)         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  SQLite Database        │
│  (ngips.db)             │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Next.js Dashboard      │
│  (Management UI)        │
└─────────────────────────┘
```

---

## Key Benefits

1. **Real-time Protection:** Blocks phishing sites before page load
2. **AI-Powered Detection:** Machine learning models with ensemble approach
3. **Centralized Management:** Single dashboard for monitoring and configuration
4. **Scalable Architecture:** Microservices-based design for easy expansion
5. **User Feedback Integration:** Continuous improvement through user input
6. **Low Latency:** Asynchronous processing for minimal user impact

---

## Next Steps

Refer to the implementation roadmap in `NGIPS_ROADMAP.md` for detailed development phases and milestones.
