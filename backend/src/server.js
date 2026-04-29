/**
 * NGIPS Phishing Shield - Express Backend Server
 * Real-time phishing detection API with ML model integration
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { timingSafeEqual } from 'crypto';
import { errorHandler } from './utils/errors.js';

// Import routes
import { analyzeUrlHandler, getScansHandler, getScanByIdHandler, submitFeedbackHandler, scanHistory } from './routes/analyze.js';
import { getStatsHandler } from './routes/stats.js';
import { getTrendsHandler, getTopDomainsHandler, getThreatClassificationHandler } from './routes/analytics.js';
import { getAllFeedbackHandler, updateFeedbackHandler } from './routes/feedback.js';
import { getSettingsHandler, updateSettingsHandler } from './routes/settings.js';
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './routes/auth.js';

// Import auth middleware
import { authMiddleware } from './utils/auth.js';

// Import ML inference
import { loadModels, getMLStatus } from './utils/mlInference.js';

// Import monitoring and retraining
import { monitor } from './utils/monitoring.js';
import { triggerRetrain, evaluateModel } from './utils/retrain.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    if (origin.includes('localhost')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 10000 : 100, // 100 requests per minute
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

// Admin API key auth middleware (timing-safe comparison)
function adminAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expected = process.env.ADMIN_API_KEY;
  
  if (!apiKey || !expected) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } });
  }
  
  try {
    const apiKeyBuf = Buffer.from(apiKey, 'utf-8');
    const expectedBuf = Buffer.from(expected, 'utf-8');
    
    if (apiKeyBuf.length !== expectedBuf.length || !timingSafeEqual(apiKeyBuf, expectedBuf)) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } });
    }
  } catch {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } });
  }
  
  next();
}

// Health check
app.get('/health', (req, res) => {
  const mlStatus = getMLStatus();
  res.json({
    status: 'healthy',
    service: 'ngips-phishing-shield',
    version,
    models: {
      status: mlStatus.loaded ? 'loaded' : 'unavailable',
      method: mlStatus.method,
      version,
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
    heuristic: { loaded: true, version }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'NGIPS Phishing Shield API',
    version,
    status: 'operational',
    docs: '/docs'
  });
});

// API Routes (public)
app.post('/v1/analyze', (req, res, next) => analyzeUrlHandler(req, res).catch(next));
app.post('/v1/feedback', (req, res, next) => submitFeedbackHandler(req, res).catch(next));
app.get('/v1/stats', (req, res, next) => getStatsHandler(req, res).catch(next));

// Scans routes (public - extension needs access)
app.get('/v1/scans', (req, res, next) => getScansHandler(req, res).catch(next));
app.get('/v1/scans/:id', (req, res, next) => getScanByIdHandler(req, res).catch(next));

// Feedback admin routes
app.get('/v1/feedback', adminAuth, (req, res, next) => getAllFeedbackHandler(req, res).catch(next));
app.patch('/v1/feedback/:id/status', adminAuth, (req, res, next) => updateFeedbackHandler(req, res).catch(next));

// Analytics routes
app.get('/v1/analytics/trends', (req, res, next) => getTrendsHandler(req, res).catch(next));
app.get('/v1/analytics/top-domains', (req, res, next) => getTopDomainsHandler(req, res).catch(next));
app.get('/v1/analytics/threats', (req, res, next) => getThreatClassificationHandler(req, res).catch(next));

// Settings routes (protected)
app.use('/v1/settings', authMiddleware);
app.get('/v1/settings', (req, res, next) => getSettingsHandler(req, res).catch(next));
app.patch('/v1/settings', (req, res, next) => updateSettingsHandler(req, res).catch(next));

// Auth routes
app.post('/v1/auth/login', (req, res, next) => loginHandler(req, res).catch(next));
app.post('/v1/auth/refresh', (req, res, next) => refreshHandler(req, res).catch(next));
app.post('/v1/auth/logout', (req, res, next) => logoutHandler(req, res).catch(next));
app.get('/v1/auth/me', (req, res, next) => meHandler(req, res).catch(next));

// Admin Routes - Model Monitoring & Retraining

// POST /v1/admin/retrain - Trigger model retraining
app.post('/v1/admin/retrain', adminAuth, async (req, res) => {
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
app.post('/v1/admin/calibrate', adminAuth, (req, res) => {
  monitor.setBaseline();
  return res.json({
    message: 'Baseline distribution calibrated',
    baseline: monitor.baselineDistribution,
    sampleSize: monitor.predictions.length,
    timestamp: new Date().toISOString()
  });
});

// POST /v1/admin/clear-history - Clear all scan history
app.post('/v1/admin/clear-history', adminAuth, (req, res) => {
  scanHistory.clear();
  return res.json({ message: 'History cleared', timestamp: new Date().toISOString() });
});

// GET /v1/admin/alerts - Get recent monitoring alerts
app.get('/v1/admin/alerts', adminAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  return res.json({
    alerts: monitor.alerts.slice(-limit).reverse(),
    total: monitor.alerts.length,
    timestamp: new Date().toISOString()
  });
});

// POST /v1/admin/evaluate - Evaluate model metrics
app.post('/v1/admin/evaluate', adminAuth, async (req, res) => {
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
app.use(errorHandler);

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

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
