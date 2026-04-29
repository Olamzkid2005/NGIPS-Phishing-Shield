/**
 * NGIPS Phishing Shield - Express Backend Server
 * Real-time phishing detection API with ML model integration
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import { analyzeUrlHandler, getScansHandler, submitFeedbackHandler, scanHistory } from './routes/analyze.js';
import { getStatsHandler } from './routes/stats.js';

// Import ML inference
import { loadModels, getMLStatus } from './utils/mlInference.js';

// Import monitoring and retraining
import { monitor } from './utils/monitoring.js';
import { triggerRetrain, evaluateModel } from './utils/retrain.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['chrome-extension://*', 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.'
    }
  }
});
app.use('/v1/', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  const mlStatus = getMLStatus();
  res.json({
    status: 'healthy',
    service: 'ngips-phishing-shield',
    version: '1.0.0',
    models: {
      status: mlStatus.loaded ? 'loaded' : 'unavailable',
      method: mlStatus.method,
      version: '1.0.0',
      available: mlStatus.loaded ? ['Python Subprocess (Ensemble)', 'Heuristic'] : ['Heuristic'],
      error: mlStatus.error
    }
  });
});

// ML model status endpoint
app.get('/v1/models/status', (req, res) => {
  const mlStatus = getMLStatus();
  res.json({
    ml: mlStatus,
    heuristic: { loaded: true, version: '1.0.0' }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'NGIPS Phishing Shield API',
    version: '1.0.0',
    status: 'operational',
    docs: '/docs'
  });
});

// API Routes
app.post('/v1/analyze', analyzeUrlHandler);
app.get('/v1/scans', getScansHandler);
app.post('/v1/feedback', submitFeedbackHandler);
app.get('/v1/stats', getStatsHandler);

// Admin Routes - Model Monitoring & Retraining

// POST /v1/admin/retrain - Trigger model retraining
app.post('/v1/admin/retrain', async (req, res) => {
  try {
    const result = await triggerRetrain(scanHistory);
    if (result.success) {
      return res.json({ message: 'Retraining completed', ...result });
    }
    return res.status(500).json({ error: { code: 'RETRAIN_FAILED', ...result } });
  } catch (error) {
    console.error('Retrain error:', error);
    return res.status(500).json({
      error: { code: 'RETRAIN_ERROR', message: error.message }
    });
  }
});

// POST /v1/admin/calibrate - Set baseline distribution for drift detection
app.post('/v1/admin/calibrate', (req, res) => {
  monitor.setBaseline();
  return res.json({
    message: 'Baseline distribution calibrated',
    baseline: monitor.baselineDistribution,
    sampleSize: monitor.predictions.length,
    timestamp: new Date().toISOString()
  });
});

// GET /v1/admin/alerts - Get recent monitoring alerts
app.get('/v1/admin/alerts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  return res.json({
    alerts: monitor.alerts.slice(-limit).reverse(),
    total: monitor.alerts.length,
    timestamp: new Date().toISOString()
  });
});

// POST /v1/admin/evaluate - Evaluate model metrics
app.post('/v1/admin/evaluate', async (req, res) => {
  try {
    const result = await evaluateModel();
    if (result.success) {
      return res.json(result);
    }
    return res.status(500).json({ error: { code: 'EVALUATION_FAILED', ...result } });
  } catch (error) {
    console.error('Evaluation error:', error);
    return res.status(500).json({
      error: { code: 'EVALUATION_ERROR', message: error.message }
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

// Start server and load models
async function startServer() {
  // Load ML models (non-blocking, system works without them)
  await loadModels();

  app.listen(PORT, () => {
    const mlStatus = getMLStatus();
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   NGIPS Phishing Shield API - Started                  ║
║   http://localhost:${PORT}                         ║
║   ML Models: ${mlStatus.loaded ? `${mlStatus.method} loaded` : 'unavailable (heuristic only)'}               ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();

export default app;
