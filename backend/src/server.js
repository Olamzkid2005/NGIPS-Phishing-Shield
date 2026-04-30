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

// Import logger
import logger from './utils/logger.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8000',
  'https://localhost:3000',
  'https://localhost:5173',
  'https://localhost:8000'
];

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: function(origin, callback) {
    if (process.env.NODE_ENV === 'production' && !origin) {
      return callback(new Error('CORS: Origin required'), false);
    }

    if (!origin) return callback(null, true);
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Login-specific rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: {
      code: 'LOGIN_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || req.ip
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { method: req.method, path: req.path });
  next();
});

// Extension API key validation (additional security layer)
function validateExtensionKey(req, res, next) {
  const extensionKey = req.headers['x-extension-key'];
  const validKey = process.env.EXTENSION_API_KEY;

  if (validKey) {
    if (!extensionKey || extensionKey !== validKey) {
      return res.status(401).json({
        error: { code: 'INVALID_EXTENSION_KEY', message: 'Invalid or missing extension API key' }
      });
    }
  }

  next();
}

// Admin API key auth middleware (timing-safe comparison)
function adminAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
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

// Extension auth bypass (check for extension origin, test env, or API key)
function extensionOrAuth(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();

  // Validate extension key if configured
  if (process.env.EXTENSION_API_KEY) {
    return validateExtensionKey(req, res, next);
  }

  const origin = req.headers.origin || '';
  const extensionId = process.env.EXTENSION_ID || '';
  if (extensionId && origin === `chrome-extension://${extensionId}`) return next();
  return authMiddleware(req, res, next);
}

// API Routes (public)
app.post('/v1/analyze', extensionOrAuth, (req, res, next) => analyzeUrlHandler(req, res).catch(next));
app.post('/v1/feedback', extensionOrAuth, (req, res, next) => submitFeedbackHandler(req, res).catch(next));

// Scans routes (protected - extension bypassed)
app.get('/v1/scans', extensionOrAuth, (req, res, next) => getScansHandler(req, res).catch(next));
app.get('/v1/scans/:id', extensionOrAuth, (req, res, next) => getScanByIdHandler(req, res).catch(next));

// Stats (protected - extension bypassed)
app.get('/v1/stats', extensionOrAuth, (req, res, next) => getStatsHandler(req, res).catch(next));

// Feedback admin routes
app.get('/v1/feedback', adminAuth, (req, res, next) => getAllFeedbackHandler(req, res).catch(next));
app.patch('/v1/feedback/:id/status', adminAuth, (req, res, next) => updateFeedbackHandler(req, res).catch(next));

// Analytics routes (protected - extension bypassed)
app.get('/v1/analytics/trends', extensionOrAuth, (req, res, next) => getTrendsHandler(req, res).catch(next));
app.get('/v1/analytics/top-domains', extensionOrAuth, (req, res, next) => getTopDomainsHandler(req, res).catch(next));
app.get('/v1/analytics/threats', extensionOrAuth, (req, res, next) => getThreatClassificationHandler(req, res).catch(next));

// Settings routes (protected)
app.use('/v1/settings', authMiddleware);
app.get('/v1/settings', (req, res, next) => getSettingsHandler(req, res).catch(next));
app.patch('/v1/settings', (req, res, next) => updateSettingsHandler(req, res).catch(next));

// Auth routes
app.post('/v1/auth/login', loginLimiter, (req, res, next) => loginHandler(req, res).catch(next));
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
    logger.error('Retrain error', { error: error.message });
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
    logger.error('Evaluation error', { error: error.message });
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

  if (!process.env.ADMIN_API_KEY) {
    logger.warn('ADMIN_API_KEY not set. Admin endpoints will be inaccessible.');
  }

  app.listen(PORT, () => {
    const mlStatus = getMLStatus();
    logger.info('NGIPS Phishing Shield API started', { port: PORT, mlStatus: mlStatus.loaded ? mlStatus.method : 'unavailable' });
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
