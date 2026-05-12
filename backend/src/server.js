/**
 * NGIPS Phishing Shield - Express Backend Server
 * Real-time phishing detection API with ML model integration
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { timingSafeEqual } from 'crypto';
import { errorHandler } from './utils/errors.js';
import { authMiddleware } from './utils/auth.js';
import { logger } from './utils/logger.js';
import { loadModels, getMLStatus } from './utils/mlInference.js';
import { analyzeUrlHandler, getScansHandler, getScanByIdHandler, submitFeedbackHandler, scanHistory } from './routes/analyze.js';
import { getStatsHandler } from './routes/stats.js';
import { getTrendsHandler, getTopDomainsHandler, getThreatClassificationHandler } from './routes/analytics.js';
import { getAllFeedbackHandler, updateFeedbackHandler } from './routes/feedback.js';
import { getSettingsHandler, updateSettingsHandler } from './routes/settings.js';
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './routes/auth.js';
import { triggerRetrain, evaluateModel } from './utils/retrain.js';
import { monitor } from './utils/monitoring.js';
import {
  ALLOWED_ORIGINS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  REFRESH_RATE_LIMIT_WINDOW_MS,
  REFRESH_RATE_LIMIT_MAX,
  MODEL_VERSION,
  ML_METHOD_PYTHON
} from './utils/constants.js';

// Package info - using direct import
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json safely - use fallback for version
let VERSION = '1.0.0';
try {
  const packageJsonPath = join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  VERSION = packageJson.version || '1.0.0';
} catch (e) {
  console.warn('[SERVER] Could not read package.json version:', e.message);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
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
const isProduction = process.env.NODE_ENV === 'production';
app.use(cors({
  origin: isProduction
    ? (ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false)
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: process.env.NODE_ENV === 'test' ? 10000 : RATE_LIMIT_MAX_REQUESTS,
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
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
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

// Token refresh rate limiter (stricter to prevent token reuse attacks)
const refreshLimiter = rateLimit({
  windowMs: REFRESH_RATE_LIMIT_WINDOW_MS,
  max: REFRESH_RATE_LIMIT_MAX,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many token refresh attempts. Please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Request ID middleware for distributed tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  logger.info(`${req.method} ${req.path}`, { method: req.method, path: req.path, requestId: req.id });
  next();
});

// Extension API key validation (additional security layer) - timing-safe comparison
function validateExtensionKey(req, res, next) {
  const extensionKey = req.headers['x-extension-key'];
  const validKey = process.env.EXTENSION_API_KEY;

  if (validKey) {
    if (!extensionKey) {
      return res.status(401).json({
        error: { code: 'INVALID_EXTENSION_KEY', message: 'Invalid or missing extension API key' }
      });
    }

    try {
      const keyBuf = Buffer.from(extensionKey, 'utf-8');
      const validBuf = Buffer.from(validKey, 'utf-8');

      // Constant-time comparison to prevent timing attacks
      if (keyBuf.length !== validBuf.length || !timingSafeEqual(keyBuf, validBuf)) {
        return res.status(401).json({
          error: { code: 'INVALID_EXTENSION_KEY', message: 'Invalid or missing extension API key' }
        });
      }
    } catch {
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
      version: MODEL_VERSION,
      available: mlStatus.loaded ? [ML_METHOD_PYTHON, 'Heuristic'] : ['Heuristic'],
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
app.post('/v1/auth/refresh', refreshLimiter, (req, res, next) => refreshHandler(req, res).catch(next));
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

// Required environment variables for production
const REQUIRED_ENV_VARS = ['JWT_SECRET'];
const OPTIONAL_ENV_VARS = ['ADMIN_API_KEY', 'EXTENSION_API_KEY', 'DATABASE_URL'];

/**
 * Validate required environment variables at startup
 */
function validateEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  }

  if (missing.length > 0) {
    logger.warn(`[ENV] Missing environment variables: ${missing.join(', ')}`);
  }

  logger.info(`[ENV] Environment: ${process.env.NODE_ENV || 'development'}`);
}

// Start server and load models
async function startServer() {
  // Validate environment first
  validateEnvironment();

  // Load ML models (non-blocking, system works without them)
  await loadModels();

  if (!process.env.ADMIN_API_KEY) {
    logger.warn('[AUTH] ADMIN_API_KEY not set. Admin endpoints will be inaccessible.');
  }

  const server = app.listen(PORT, () => {
    const mlStatus = getMLStatus();
    logger.info('NGIPS Phishing Shield API started', { port: PORT, mlStatus: mlStatus.loaded ? mlStatus.method : 'unavailable' });
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal) => {
    logger.info(`[SHUTDOWN] Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async (err) => {
      if (err) {
        logger.error('[SHUTDOWN] Error closing server:', err.message);
        process.exit(1);
      }

      logger.info('[SHUTDOWN] No more incoming connections');

      try {
        // Disconnect database
        const { prisma } = await import('./utils/database.js');
        await prisma.$disconnect();
        logger.info('[SHUTDOWN] Database disconnected');
      } catch (dbError) {
        logger.warn('[SHUTDOWN] Database disconnect error:', dbError.message);
      }

      logger.info('[SHUTDOWN] Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.error('[SHUTDOWN] Forcing exit after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
